function scoreboardPageHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Arcade Tournament Scoreboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f1218;
      color: #e8eaf0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px;
    }
    header {
      text-align: center;
      padding: 8px 0 20px;
    }
    header h1 {
      font-size: 2.2rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      background: linear-gradient(90deg, #ffd23f, #ff6b6b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #161b24;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,.5);
    }
    thead th {
      background: #1e2430;
      font-size: 1.1rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 16px 12px;
      color: #9aa3b2;
      text-align: left;
    }
    tbody td {
      padding: 18px 12px;
      border-top: 1px solid #232a37;
      font-size: 1.35rem;
    }
    .rank { width: 12%; font-weight: 700; }
    .player { width: 44%; font-weight: 600; }
    .score { width: 14%; font-weight: 800; color: #ffd23f; font-variant-numeric: tabular-nums; }
    .status { width: 14%; }
    .actions { width: 16%; }
    .row-first td { background: rgba(255,210,63,.12); }
    .row-second td { background: rgba(192,200,214,.12); }
    .row-third td { background: rgba(205,127,50,.12); }
    .playing { color: #3ddc84; font-weight: 600; }
    .idle { color: #8a93a6; }
    .btn {
      background: #26a3ff;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .updated {
      margin-top: 14px;
      text-align: center;
      color: #6b7382;
      font-size: .9rem;
    }
    .empty { text-align: center; padding: 60px 20px; color: #8a93a6; font-size: 1.3rem; }
    .fade { transition: background-color .3s; }
  </style>
</head>
<body>
  <header>
    <h1>Arcade Tournament</h1>
  </header>
  <div id="board"></div>
  <div class="updated" id="updated"></div>

  <script>
    var medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

    function render(data) {
      var board = document.getElementById('board');
      if (!data || data.length === 0) {
        board.innerHTML = '<table><tbody><tr><td class="empty">No scores yet</td></tr></tbody></table>';
      } else {
        var rows = data.map(function (e) {
          var cls = e.rank === 1 ? 'row-first' : (e.rank === 2 ? 'row-second' : (e.rank === 3 ? 'row-third' : ''));
          var status = Number(e.currently_playing) > 0
            ? '<span class="playing">● Playing</span>'
            : '<span class="idle">Idle</span>';
          return '<tr class="fade ' + cls + '">' +
            '<td class="rank">' + e.rank + ' ' + (medals[e.rank] || '') + '</td>' +
            '<td class="player">' + escapeHtml(e.player_name) + '</td>' +
            '<td class="score">' + (Number(e.total_score) || 0).toLocaleString() + '</td>' +
            '<td class="status">' + status + '</td>' +
            '</tr>';
        }).join('');
        board.innerHTML = '<table><thead><tr>' +
          '<th class="rank">Rank</th><th class="player">Player</th>' +
          '<th class="score">Score</th><th class="status">Status</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>';
      }
      document.getElementById('updated').textContent =
        'Updated ' + new Date().toLocaleTimeString();
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str == null ? '' : String(str);
      return div.innerHTML;
    }

    function load() {
      fetch('/api/scoreboard')
        .then(function (r) { return r.json(); })
        .then(render)
        .catch(function () {
          document.getElementById('board').innerHTML =
            '<div class="empty">Unable to reach scoreboard</div>';
        });
    }

    load();
    setInterval(load, 5000);
  </script>
</body>
</html>`;
}

module.exports = { scoreboardPageHtml };
