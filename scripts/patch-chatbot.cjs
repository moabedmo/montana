const fs = require('fs');
const p = 'index.html';
let h = fs.readFileSync(p, 'utf8');
const start = h.indexOf('<!-- MONTANA CHATBOT WIDGET -->');
if (start < 0) throw new Error('marker not found');

const tail = `<!-- MONTANA CHATBOT -->
<link rel="stylesheet" href="css/chatbot.css?v=3">
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<div id="chat-btn-wrap">
  <button type="button" id="chat-btn" aria-label="Chat">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    <div id="chat-notif">1</div>
  </button>
</div>
<div id="chat-window">
  <div id="chat-header">
    <div class="avatar"></div>
    <div class="info">
      <div class="name"></div>
      <div class="status" id="chat-status"></div>
    </div>
    <button type="button" id="chat-close" aria-label="Close"></button>
  </div>
  <div id="chat-messages"></div>
  <div id="chat-input-area">
    <button type="button" id="chat-send"></button>
    <input type="text" id="chat-input" autocomplete="off">
  </div>
</div>
<script src="js/chatbot.js?v=3"></script>
`;

fs.writeFileSync(p, h.slice(0, start) + tail + '</body>\n</html>\n', 'utf8');
console.log('lines:', fs.readFileSync(p, 'utf8').split('\n').length);
