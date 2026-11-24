<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/security-headers.php';
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pickup Queue | Hungry Potters</title>
    <link rel="stylesheet" href="assets/css/queue-display.css">
    <script src="assets/js/queue-display.js" defer></script>
</head>
<body>
    <main class="queue-screen">
        <header class="queue-header">
            <div class="brand">
                <img class="brand-logo" src="assets/images/logo.png" alt="Hungry Potters logo" width="768" height="768">
                <div>
                    <p class="brand-eyebrow">Hungry Potters</p>
                    <h1>Pickup Queue</h1>
                </div>
            </div>
            <div class="header-status">
                <div class="time-block">
                    <div class="live-time"><span class="live-dot" aria-hidden="true"></span><span>Live</span><time data-live-clock>--:--:--</time></div>
                    <p class="last-updated">Last updated <time data-last-updated>Waiting for update</time></p>
                </div>
                <div class="sound-control">
                    <button class="sound-toggle" type="button" data-sound-toggle aria-pressed="false">Chime: off</button>
                    <small class="sound-help" data-sound-help role="status">Enable pickup alerts</small>
                </div>
            </div>
        </header>
        <p class="connection-message" data-connection-message role="status" aria-live="polite" hidden></p>
        <div class="queue-columns">
            <section class="queue-lane queue-lane--preparing" aria-labelledby="preparing-heading">
                <div class="lane-heading">
                    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>
                    <h2 id="preparing-heading">Preparing</h2>
                </div>
                <div class="queue-list" data-queue-list="preparing" data-count="0" aria-live="polite"></div>
            </section>
            <section class="queue-lane queue-lane--ready" aria-labelledby="ready-heading">
                <div class="lane-heading">
                    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.7 2.7L16 9"/></svg>
                    <h2 id="ready-heading">Ready for pickup</h2>
                </div>
                <div class="queue-list" data-queue-list="ready" data-count="0" aria-live="polite"></div>
            </section>
        </div>
    </main>
</body>
</html>
