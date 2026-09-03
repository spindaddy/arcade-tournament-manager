function themeCss(name, t) {
  return `
  body { background: ${t.bg}; color: ${t.text}; }
  header h1 { background: linear-gradient(90deg, ${t.titleStart}, ${t.titleEnd}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  table { background: ${t.panel}; }
  thead th { background: ${t.header}; color: ${t.muted}; }
  tbody td { border-top: 1px solid ${t.border}; }
  .score { color: ${t.score}; }
  .idle { color: ${t.idle}; }
  .playing { color: ${t.playing}; }
  .row-first td { background: ${t.row1}; }
  .row-second td { background: ${t.row2}; }
  .row-third td { background: ${t.row3}; }
  .updated { color: ${t.muted}; }
  .empty { color: ${t.idle}; }
  `;
}

function scoreboardPageHtml() {
  const THEMES = {
    dark: {
      bg: '#0f1218', panel: '#161b24', header: '#1e2430', border: '#232a37',
      text: '#e8eaf0', muted: '#9aa3b2', idle: '#8a93a6',
      titleStart: '#ffd23f', titleEnd: '#ff6b6b', score: '#ffd23f',
      row1: 'rgba(255,210,63,.12)', row2: 'rgba(192,200,214,.12)', row3: 'rgba(205,127,50,.12)',
      playing: '#3ddc84'
    },
    light: {
      bg: '#f4f5f7', panel: '#ffffff', header: '#eef0f3', border: '#e2e5ea',
      text: '#1c2128', muted: '#5b6472', idle: '#7b8494',
      titleStart: '#f59e0b', titleEnd: '#ef4444', score: '#b45309',
      row1: 'rgba(245,158,11,.10)', row2: 'rgba(100,110,130,.08)', row3: 'rgba(205,127,50,.10)',
      playing: '#16a34a'
    },
    neon: {
      bg: '#0b0f1a', panel: '#111631', header: '#181f3f', border: '#2a3566',
      text: '#e6eaff', muted: '#8d97c9', idle: '#6e76a0',
      titleStart: '#00f5ff', titleEnd: '#ff00e5', score: '#00f5ff',
      row1: 'rgba(0,245,255,.12)', row2: 'rgba(150,120,255,.12)', row3: 'rgba(255,0,229,.10)',
      playing: '#00ff9d'
    },
    forest: {
      bg: '#10150f', panel: '#172118', header: '#1f2d21', border: '#2a3a2c',
      text: '#e8f0e6', muted: '#9db09a', idle: '#7c8a79',
      titleStart: '#8ee06e', titleEnd: '#c8e069', score: '#a9f07d',
      row1: 'rgba(142,224,110,.10)', row2: 'rgba(120,160,110,.10)', row3: 'rgba(200,224,105,.08)',
      playing: '#7ceb9a'
    }
  };

  const themesLiteral = JSON.stringify(THEMES);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Arcade Tournament Scoreboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 24px; transition: background .3s, color .3s; }
    header { text-align: center; padding: 8px 0 20px; width: 100%; }
    header h1 { font-size: 2.2rem; letter-spacing: 2px; text-transform: uppercase; }
    #board { width: 60%; }
    table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.4); }
    thead th { font-size: 1.1rem; letter-spacing: 1px; text-transform: uppercase; padding: 16px 12px; text-align: left; }
    tbody td { padding: 18px 12px; font-size: 1.35rem; }
    .rank { width: 8%; font-weight: 700; }
    .player { width: 34%; font-weight: 600; }
    .twitch { width: 26%; }
    .player-link { color: inherit; text-decoration: underline; }
    .score { width: 14%; font-weight: 800; font-variant-numeric: tabular-nums; }
    .status { width: 18%; }
    .division-grid { margin-bottom: 32px; }
    .division-title { font-size: 1.5rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 12px; }
    .playing { font-weight: 600; }
    .fade { transition: background-color .3s; }
    .updated { margin-top: 14px; text-align: center; font-size: .9rem; }
    .empty { text-align: center; padding: 60px 20px; font-size: 1.3rem; }
  </style>
  <style id="themeStyle"></style>
</head>
<body>
  <header><h1 id="title">Arcade Tournament</h1></header>
  <div id="board"></div>
  <div class="updated" id="updated"></div>

  <script>
    var THEMES = ${themesLiteral};
    var medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    var currentTheme = 'dark';

    function cssFor(t) {
      return "body { background:" + t.bg + "; color:" + t.text + "; }" +
        "header h1 { background: linear-gradient(90deg," + t.titleStart + "," + t.titleEnd + "); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }" +
        "table { background:" + t.panel + "; }" +
        "thead th { background:" + t.header + "; color:" + t.muted + "; }" +
        "tbody td { border-top:1px solid " + t.border + "; }" +
        ".score { color:" + t.score + "; }" +
        ".division-title { color:" + t.score + "; }" +
        ".twitch a { color:" + t.score + "; text-decoration: underline; }" +
        ".idle { color:" + t.idle + "; }" +
        ".playing { color:" + t.playing + "; }" +
        ".row-first td { background:" + t.row1 + "; }" +
        ".row-second td { background:" + t.row2 + "; }" +
        ".row-third td { background:" + t.row3 + "; }" +
        ".updated { color:" + t.muted + "; }" +
        ".empty { color:" + t.idle + "; }";
    }

    function applyTheme(name) {
      currentTheme = THEMES[name] ? name : 'dark';
      document.getElementById('themeStyle').textContent = cssFor(THEMES[currentTheme]);
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str == null ? '' : String(str);
      return div.innerHTML;
    }

    function render(data, divisions) {
      var board = document.getElementById('board');
      if (!data || data.length === 0) {
        board.innerHTML = '<table><tbody><tr><td class="empty">No scores yet</td></tr></tbody></table>';
      } else {
        var groups = {};
        var divConfig = {};
        (divisions || []).forEach(function (d) {
          if (typeof d === 'string') d = { name: d, active: true, sort_order: 0 };
          divConfig[d.name] = d;
        });
        data.forEach(function (e) {
          var key = e.division || 'Open';
          if (!groups[key]) groups[key] = [];
          groups[key].push(e);
        });
        var keys = Object.keys(groups)
          .filter(function (k) {
            if (k === 'Open') return true;
            var c = divConfig[k];
            return !c || c.active !== false;
          })
          .sort(function (a, b) {
            if (a === 'Open') return 1;
            if (b === 'Open') return -1;
            var sa = (divConfig[a] && divConfig[a].sort_order) || 0;
            var sb = (divConfig[b] && divConfig[b].sort_order) || 0;
            return sa - sb;
          });

        var html = keys.map(function (division) {
          var rank = 0;
          var lastScore = null;
          var max = (divConfig[division] && divConfig[division].max) || 0;
          var rows = groups[division].slice(0, max || groups[division].length).map(function (e) {
            if (e.total_score !== lastScore) { rank++; lastScore = e.total_score; }
            var cls = rank === 1 ? 'row-first' : (rank === 2 ? 'row-second' : (rank === 3 ? 'row-third' : ''));
            var status = Number(e.currently_playing) > 0
              ? '<span class="playing">● Playing</span>'
              : '<span class="idle">Idle</span>';
            var twitchCell = e.twitch_name
              ? '<a class="player-link" href="https://twitch.tv/' + encodeURIComponent(e.twitch_name) + '" target="_blank">' + escapeHtml(e.twitch_name) + '</a>'
              : '<span class="idle">—</span>';
            return '<tr class="fade ' + cls + '">' +
              '<td class="rank">' + rank + ' ' + (medals[rank] || '') + '</td>' +
              '<td class="player">' + escapeHtml(e.player_name) + '</td>' +
              '<td class="twitch">' + twitchCell + '</td>' +
              '<td class="score">' + (Number(e.total_score) || 0).toLocaleString() + '</td>' +
              '<td class="status">' + status + '</td>' +
              '</tr>';
          }).join('');

          return '<div class="division-grid">' +
            '<div class="division-title">' + escapeHtml(division) + '</div>' +
            '<table><thead><tr>' +
            '<th class="rank">Rank</th><th class="player">Player</th>' +
            '<th class="twitch">Twitch</th><th class="score">Score</th><th class="status">Status</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '</div>';
        }).join('');

        board.innerHTML = html;
      }
      document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
    }

    function load() {
      Promise.all([fetch('/api/scoreboard').then(function (r) { return r.json(); }),
                   fetch('/api/settings').then(function (r) { return r.json(); })])
        .then(function (res) {
          var divisions = [];
          if (res[1] && res[1].divisions) {
            try { divisions = JSON.parse(res[1].divisions); } catch (e) { divisions = []; }
          }
          render(res[0], divisions);
        })
        .catch(function () {
          document.getElementById('board').innerHTML = '<div class="empty">Unable to reach scoreboard</div>';
        });
    }

    function loadMeta() {
      fetch('/api/meta')
        .then(function (r) { return r.json(); })
        .then(function (m) {
          if (m && m.title) document.getElementById('title').textContent = m.title;
          document.title = (m && m.title ? m.title : 'Arcade Tournament') + ' — Scoreboard';
          if (m && m.theme) applyTheme(m.theme);
        })
        .catch(function () {});
    }

    loadMeta();

    load();
    setInterval(load, 5000);
  </script>
</body>
</html>`;
}

module.exports = { scoreboardPageHtml };
