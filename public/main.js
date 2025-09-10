async function loadPreview() {
	const res = await fetch('/api/preview');
	if (!res.ok) throw new Error('Failed to load preview');
	return res.json();
}

function renderRecipients(recipients) {
	const tbody = document.querySelector('#recipientsTable tbody');
	tbody.innerHTML = '';
	recipients.forEach(r => {
		const tr = document.createElement('tr');
		const tdName = document.createElement('td');
		const tdEmail = document.createElement('td');
		tdName.textContent = r.name;
		tdEmail.textContent = r.email;
		tr.appendChild(tdName);
		tr.appendChild(tdEmail);
		tbody.appendChild(tr);
	});
}

function setStatus(text, kind = 'info') {
	const el = document.getElementById('status');
	el.textContent = text || '';
	el.style.color = kind === 'error' ? '#ef4444' : kind === 'success' ? '#22c55e' : '#94a3b8';
}

async function sendAll() {
	const btn = document.getElementById('sendBtn');
	btn.disabled = true;
	setStatus('Sending emails...');
	try {
		const res = await fetch('/api/send', { method: 'POST' });
		const data = await res.json();
		if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send');
		setStatus(`Sent ${data.count} emails successfully.`, 'success');
	} catch (err) {
		console.error(err);
		setStatus(String(err.message || err), 'error');
	} finally {
		btn.disabled = false;
	}
}

(async function init() {
	try {
		const data = await loadPreview();
		document.getElementById('sender').textContent = data.from;
		document.getElementById('subject').textContent = data.subject;
		document.getElementById('previewHeader').textContent = data.subject;
		document.getElementById('previewBody').innerHTML = data.html;
		renderRecipients(data.recipients);
		setStatus('Ready');
	} catch (e) {
		console.error(e);
		setStatus('Failed to load configuration', 'error');
	}
		document.getElementById('sendBtn').addEventListener('click', sendAll);
})();
