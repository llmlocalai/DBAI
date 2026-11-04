(function () {
  if (window.__ccarTutorLoaded) return;
  window.__ccarTutorLoaded = true;

  var css = `
  .ccar-tutor-btn{position:fixed;bottom:20px;right:20px;z-index:99999;width:56px;height:56px;
    border-radius:50%;background:#2d5d6b;color:#fff;border:none;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:24px;display:flex;align-items:center;justify-content:center}
  .ccar-tutor-btn:hover{background:#163b47}
  .ccar-tutor-panel{position:fixed;bottom:88px;right:20px;z-index:99999;width:360px;max-width:92vw;
    height:min(560px,75vh);background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.3);
    display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    border:1px solid #e0dbcc}
  .ccar-tutor-panel.open{display:flex}
  .ccar-tutor-head{background:#2d5d6b;color:#fff;padding:12px 14px;font-weight:600;font-size:14px;
    display:flex;justify-content:space-between;align-items:center}
  .ccar-tutor-head span.sub{display:block;font-weight:400;font-size:11px;opacity:.85;margin-top:2px}
  .ccar-tutor-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1}
  .ccar-tutor-msgs{flex:1;overflow-y:auto;padding:12px;background:#f7f4ee;display:flex;flex-direction:column;gap:10px}
  .ccar-tutor-msg{max-width:88%;padding:8px 11px;border-radius:10px;font-size:13.5px;line-height:1.45;white-space:pre-wrap}
  .ccar-tutor-msg.user{align-self:flex-end;background:#2d5d6b;color:#fff}
  .ccar-tutor-msg.bot{align-self:flex-start;background:#fff;color:#211f1a;border:1px solid #e0dbcc}
  .ccar-tutor-msg.sources{align-self:flex-start;background:transparent;color:#6b6557;font-size:11px;padding:0 4px}
  .ccar-tutor-input{display:flex;border-top:1px solid #e0dbcc;padding:8px;gap:6px;background:#fff}
  .ccar-tutor-input input{flex:1;border:1px solid #e0dbcc;border-radius:8px;padding:8px 10px;font-size:13.5px;outline:none}
  .ccar-tutor-input button{background:#2d5d6b;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}
  .ccar-tutor-input button:disabled{opacity:.5;cursor:default}
  @media (prefers-color-scheme: dark){
    .ccar-tutor-panel{background:#1f2225;border-color:#33373b}
    .ccar-tutor-msgs{background:#17191b}
    .ccar-tutor-msg.bot{background:#262a2e;color:#eae6dc;border-color:#33373b}
    .ccar-tutor-input{background:#1f2225;border-color:#33373b}
    .ccar-tutor-input input{background:#262a2e;border-color:#33373b;color:#eae6dc}
  }
  `;
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'ccar-tutor-btn';
  btn.setAttribute('aria-label', 'Open AI tutor');
  btn.textContent = '💬';

  var panel = document.createElement('div');
  panel.className = 'ccar-tutor-panel';
  panel.innerHTML =
    '<div class="ccar-tutor-head"><div>AI Tutor<span class="sub">CCAR-P &times; Databricks course</span></div>' +
    '<button class="ccar-tutor-close" aria-label="Close">&times;</button></div>' +
    '<div class="ccar-tutor-msgs"></div>' +
    '<div class="ccar-tutor-input">' +
    '<input type="text" placeholder="Ask about the course material...">' +
    '<button>Send</button></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgsEl = panel.querySelector('.ccar-tutor-msgs');
  var input = panel.querySelector('input');
  var sendBtn = panel.querySelector('.ccar-tutor-input button');
  var closeBtn = panel.querySelector('.ccar-tutor-close');
  var history = [];

  function addMsg(text, cls) {
    var d = document.createElement('div');
    d.className = 'ccar-tutor-msg ' + cls;
    d.textContent = text;
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return d;
  }

  if (msgsEl.children.length === 0) {
    addMsg('Hi! Ask me anything about this course — RAG agents, agentic apps, evaluation, or deployment & monitoring on Databricks.', 'bot');
  }

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    history.push({ role: 'user', content: text });
    sendBtn.disabled = true;
    var thinking = addMsg('Thinking…', 'bot');

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        thinking.remove();
        if (data.reply) {
          addMsg(data.reply, 'bot');
          history.push({ role: 'assistant', content: data.reply });
          if (data.sources && data.sources.length) {
            var uniq = [];
            var seen = {};
            data.sources.forEach(function (s) {
              var k = s.module + '::' + s.lecture;
              if (!seen[k]) { seen[k] = 1; uniq.push(s.module + ' — ' + s.lecture); }
            });
            addMsg('Sources: ' + uniq.slice(0, 3).join(' · '), 'sources');
          }
        } else {
          addMsg((data.error || 'The tutor is not configured yet.') + (data.hint ? '\n' + data.hint : ''), 'bot');
        }
      })
      .catch(function (e) {
        thinking.remove();
        addMsg('Could not reach the tutor API: ' + e.message, 'bot');
      })
      .finally(function () { sendBtn.disabled = false; });
  }

  btn.addEventListener('click', function () { panel.classList.toggle('open'); });
  closeBtn.addEventListener('click', function () { panel.classList.remove('open'); });
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
})();
