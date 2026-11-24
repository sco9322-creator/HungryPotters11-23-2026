'use strict';

(() => {
    const preparingList = document.querySelector('[data-queue-list="preparing"]');
    const readyList = document.querySelector('[data-queue-list="ready"]');
    const lastUpdated = document.querySelector('[data-last-updated]');
    const liveClock = document.querySelector('[data-live-clock]');
    const connectionMessage = document.querySelector('[data-connection-message]');
    const soundToggle = document.querySelector('[data-sound-toggle]');
    const soundHelp = document.querySelector('[data-sound-help]');
    const timeFormatter = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    let requestPending = false;
    let previousReadyNumbers = null;
    let audioContext = null;
    let soundEnabled = false;
    const CHIME_VOLUME = 0.35;
    let chimePlaying = false;
    let resizePending = false;
    let currentPreparingOrders = [];
    let currentReadyOrders = [];

    function updateClock() {
        const now = new Date();
        liveClock.dateTime = now.toISOString();
        liveClock.textContent = timeFormatter.format(now);
    }

    function renderList(list, orders, newNumbers = new Set()) {
        list.replaceChildren();
        list.dataset.count = String(orders.length);
        if (orders.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'queue-empty';
            empty.textContent = list === preparingList
                ? 'No orders in preparation'
                : 'No orders ready for pickup';
            list.append(empty);
            return;
        }

        const styles = getComputedStyle(list);
        const columns = styles.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
        const chipHeight = Number.parseFloat(styles.gridAutoRows);
        const rowGap = Number.parseFloat(styles.rowGap) || 0;
        const rows = chipHeight > 0
            ? Math.floor((list.clientHeight + rowGap) / (chipHeight + rowGap))
            : 0;
        const capacity = columns * rows;
        const visibleCount = orders.length > capacity
            ? Math.max(0, capacity - 1)
            : Math.min(orders.length, capacity);

        for (const order of orders.slice(0, visibleCount)) {
            const number = String(order.queue_number);
            const card = document.createElement('div');
            card.className = 'queue-card';
            if (newNumbers.has(number)) {
                card.classList.add('queue-card--new');
            }
            card.textContent = `Q-${number.padStart(3, '0')}`;
            list.append(card);
        }

        const hiddenCount = orders.length - visibleCount;
        if (hiddenCount > 0 && capacity > 0) {
            const more = document.createElement('div');
            more.className = 'queue-overflow';
            more.textContent = `+${hiddenCount} more`;
            list.append(more);
        }
    }

    function scheduleRender() {
        if (resizePending) {
            return;
        }

        resizePending = true;
        window.requestAnimationFrame(() => {
            resizePending = false;
            renderList(preparingList, currentPreparingOrders);
            renderList(readyList, currentReadyOrders);
        });
    }

    function updateSoundButton() {
        soundToggle.textContent = `Chime: ${soundEnabled ? 'on' : 'off'}`;
        soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    }

    function playChime() {
        if (!soundEnabled || !audioContext || audioContext.state !== 'running' || chimePlaying) {
            return;
        }

        chimePlaying = true;
        const now = audioContext.currentTime;
        const masterGain = audioContext.createGain();
        const compressor = audioContext.createDynamicsCompressor();
        masterGain.gain.setValueAtTime(CHIME_VOLUME, now);
        compressor.threshold.setValueAtTime(-12, now);
        compressor.knee.setValueAtTime(6, now);
        compressor.ratio.setValueAtTime(12, now);
        compressor.attack.setValueAtTime(.003, now);
        compressor.release.setValueAtTime(.25, now);
        masterGain.connect(compressor);
        compressor.connect(audioContext.destination);

        const partials = [
            { ratio: 1, volume: 1, decay: 1.6 },
            { ratio: 2.76, volume: .5, decay: 1.0 },
            { ratio: 5.4, volume: .3, decay: .6 },
            { ratio: 8.93, volume: .15, decay: .3 },
        ];
        const notes = [
            { frequency: 880, start: now },
            { frequency: 660, start: now + .35 },
        ];
        let remainingOscillators = notes.length * partials.length;

        for (const note of notes) {
            for (const partial of partials) {
                const oscillator = audioContext.createOscillator();
                const partialGain = audioContext.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(note.frequency * partial.ratio, note.start);
                partialGain.gain.setValueAtTime(.0001, note.start);
                partialGain.gain.linearRampToValueAtTime(partial.volume, note.start + .005);
                partialGain.gain.exponentialRampToValueAtTime(.0001, note.start + partial.decay);
                oscillator.connect(partialGain);
                partialGain.connect(masterGain);
                oscillator.onended = () => {
                    oscillator.disconnect();
                    partialGain.disconnect();
                    remainingOscillators -= 1;
                    if (remainingOscillators === 0) {
                        masterGain.disconnect();
                        compressor.disconnect();
                        chimePlaying = false;
                    }
                };
                oscillator.start(note.start);
                oscillator.stop(note.start + partial.decay + .01);
            }
        }
    }

    async function toggleSound() {
        if (soundEnabled) {
            soundEnabled = false;
            updateSoundButton();
            soundHelp.textContent = 'The optional chime is off.';
            return;
        }

        if (typeof window.AudioContext !== 'function') {
            soundHelp.textContent = 'This browser does not support the optional chime.';
            return;
        }

        try {
            audioContext ??= new window.AudioContext();
            await audioContext.resume();
            soundEnabled = audioContext.state === 'running';
            soundHelp.textContent = soundEnabled
                ? 'A bell plays when a new number is ready.'
                : 'Audio is blocked. Try clicking the toggle again.';
        } catch {
            soundEnabled = false;
            soundHelp.textContent = 'Could not enable sound in this browser.';
        }
        updateSoundButton();
        if (soundEnabled) {
            playChime();
        }
    }

    async function refreshQueue() {
        if (requestPending) {
            return;
        }
        requestPending = true;
        try {
            const response = await fetch('api/queue-status.php', {
                method: 'GET',
                headers: { Accept: 'application/json' },
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error('Queue request failed.');
            }
            const orders = await response.json();
            if (!Array.isArray(orders) || orders.some((order) => (
                !order
                || typeof order !== 'object'
                || Array.isArray(order)
                || Object.keys(order).length !== 2
                || !Number.isInteger(order.queue_number)
                || !['preparing', 'completed'].includes(order.status)
            ))) {
                throw new Error('Queue response was invalid.');
            }

            const preparingOrders = orders
                .filter((order) => order.status === 'preparing')
                .sort((a, b) => a.queue_number - b.queue_number);
            const readyOrders = orders
                .filter((order) => order.status === 'completed')
                .sort((a, b) => b.queue_number - a.queue_number);
            const currentReadyNumbers = new Set(readyOrders.map((order) => String(order.queue_number)));
            const newReadyNumbers = previousReadyNumbers === null
                ? new Set()
                : new Set([...currentReadyNumbers].filter((number) => !previousReadyNumbers.has(number)));

            currentPreparingOrders = preparingOrders;
            currentReadyOrders = readyOrders;
            renderList(preparingList, preparingOrders);
            renderList(readyList, readyOrders, newReadyNumbers);
            previousReadyNumbers = currentReadyNumbers;
            lastUpdated.dateTime = new Date().toISOString();
            lastUpdated.textContent = timeFormatter.format(new Date());
            connectionMessage.hidden = true;
            if (newReadyNumbers.size > 0) {
                playChime();
            }
        } catch {
            connectionMessage.textContent = 'Live queue unavailable. Reconnecting...';
            connectionMessage.hidden = false;
        } finally {
            requestPending = false;
        }
    }

    soundToggle.addEventListener('click', toggleSound);
    updateClock();
    window.setInterval(updateClock, 1000);
    window.addEventListener('resize', scheduleRender);
    refreshQueue();
    window.setInterval(refreshQueue, 5000);
})();
