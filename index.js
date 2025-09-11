import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ===== EMAIL CONFIGURATION =====
// Email configuration name - set in .env.local or defaults to 'example-email'
const EMAIL_CONFIG_NAME = process.env.EMAIL_CONFIG_NAME || 'example-email';

// Load the selected email configuration
let EMAIL_CONFIG;
if (EMAIL_CONFIG_NAME === 'finnish-email') {
    const { EMAIL_CONFIG: config } = await import('./email-configs/finnish-email.js');
    EMAIL_CONFIG = config;
} else if (EMAIL_CONFIG_NAME === 'finnish-email-test') {
    const { EMAIL_CONFIG: config } = await import('./email-configs/finnish-email-test.js');
    EMAIL_CONFIG = config;
} else if (EMAIL_CONFIG_NAME === 'english-email') {
    const { EMAIL_CONFIG: config } = await import('./email-configs/english-email.js');
    EMAIL_CONFIG = config;
} else if (EMAIL_CONFIG_NAME === 'swedish-email') {
    const { EMAIL_CONFIG: config } = await import('./email-configs/swedish-email.js');
    EMAIL_CONFIG = config;
} else if (EMAIL_CONFIG_NAME === 'example-email') {
    const { EMAIL_CONFIG: config } = await import('./email-configs/example-email.js');
    EMAIL_CONFIG = config;
} else {
    throw new Error(`Unknown email config: ${EMAIL_CONFIG_NAME}. Available configs: finnish-email, english-email, swedish-email, example-email`);
}

// Sender configuration from environment variables
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'your-email@yourdomain.com';
const SENDER_NAME = process.env.SENDER_NAME || 'Your Company';

// Email configuration loaded from selected config file
const EMAIL_SUBJECT = EMAIL_CONFIG.subject;
const RECIPIENTS = EMAIL_CONFIG.recipients;
const EMAIL_HTML = EMAIL_CONFIG.html;



// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create transporter using SMTP configuration from environment variables
function createTransporter() {
	return nodemailer.createTransport({
		host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.eu',
		port: parseInt(process.env.ZOHO_SMTP_PORT) || 587,
		secure: false,
		auth: {
			user: process.env.ZOHO_SMTP_USER || 'your-email@yourdomain.com',
			pass: process.env.ZOHO_SMTP_PASSWORD,
		},
		tls: {
			rejectUnauthorized: true,
			minVersion: 'TLSv1.2'
		}
	});
}

// API: Get config/preview
app.get('/api/preview', (req, res) => {
	// Show preview with first recipient's name (capitalized)
	const firstRecipient = RECIPIENTS[0];
	const capitalizedName = firstRecipient ? firstRecipient.name.charAt(0).toUpperCase() + firstRecipient.name.slice(1) : 'Recipient';
	const previewSubject = EMAIL_SUBJECT.replace(/\{\{RECIPIENT_NAME\}\}/g, capitalizedName);
	const previewHtml = EMAIL_HTML.replace(/\{\{RECIPIENT_NAME\}\}/g, capitalizedName);
	
	res.json({
		from: SENDER_EMAIL,
		recipients: RECIPIENTS,
		subject: previewSubject,
		html: previewHtml,
		configName: EMAIL_CONFIG_NAME
	});
});

// API: Send emails to all recipients
app.post('/api/send', async (req, res) => {
	const transporter = createTransporter();

	try {
		const sendResults = [];
		console.log(`Starting to send emails to ${RECIPIENTS.length} recipients...`);
		
		for (const recipient of RECIPIENTS) {
			try {
				console.log(`Sending email to: ${recipient.name} (${recipient.email})`);
				
				// Capitalize first letter of recipient name
				const capitalizedName = recipient.name.charAt(0).toUpperCase() + recipient.name.slice(1);
				
				// Replace placeholder with actual recipient name in both subject and HTML
				const personalizedSubject = EMAIL_SUBJECT.replace(/\{\{RECIPIENT_NAME\}\}/g, capitalizedName);
				const personalizedHtml = EMAIL_HTML.replace(/\{\{RECIPIENT_NAME\}\}/g, capitalizedName);
				
				// Handle multiple emails per recipient (comma-separated)
				const emailList = recipient.email.split(',').map(email => email.trim());
				
				const info = await transporter.sendMail({
					from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
					to: emailList, // Send to all emails for this recipient
					subject: personalizedSubject,
					html: personalizedHtml
				});
				
				console.log(`✓ Email sent successfully to: ${recipient.name} (Message ID: ${info.messageId})`);
				
				sendResults.push({ 
					recipient: recipient.name, 
					emails: emailList, 
					messageId: info.messageId 
				});
			} catch (recipientError) {
				console.error(`❌ Failed to send email to: ${recipient.name} (${recipient.email}) - Error: ${recipientError.message}`);
				// Continue with next recipient instead of stopping the entire process
				sendResults.push({ 
					recipient: recipient.name, 
					emails: recipient.email.split(',').map(email => email.trim()), 
					error: recipientError.message 
				});
			}
		}
		
		console.log(`All emails sent successfully! Total: ${sendResults.length} recipients`);

		return res.json({ 
			success: true, 
			count: sendResults.length, 
			results: sendResults,
			configName: EMAIL_CONFIG_NAME
		});
	} catch (error) {
		console.error(`❌ Error sending email: ${error.message}`);
		return res.status(500).json({ success: false, error: String(error) });
	}
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
