📧 EMAIL REMINDER SYSTEM

📝 DESCRIPTION

  The Email Reminder System is a full-stack web application designed to help users schedule, manage, and automatically send email reminders.
  It provides a clean and intuitive interface where users can:
      Set recipient details (email address)
      Write custom message content
      Specify reminder dates and times
  The backend, built with Node.js and Express.js, handles automated email sending through Nodemailer, while MongoDB securely stores reminder data.
  This system ensures that important tasks, deadlines, or meetings are never missed by automating email notifications.

💡 PROBLEM STATEMENT

   In today’s busy world, people often forget important meetings, deadlines, or events.
   Manual reminder setups or calendar apps may lack flexibility for personalized emails.
   This project aims to provide a smart and customizable reminder system that automatically triggers emails at the right time — helping users stay organized and never miss     an important task.

⚙️ TECHNOLOGY STACK

   Layer                 : Technology Used

  Frontend               : HTML, CSS, JavaScript
  Backend	               : Node.js, Express.js
  Database               : MongoDB (Mongoose ORM)
  Email Service	         : Nodemailer
  Environment Management : dotenv
  Runtime Environment	   : Node.js

🚀 FEATURES

  Automated Email Reminders: Send emails at scheduled times via Nodemailer.
  Custom Scheduling: Set reminders with specific dates and times.
  Persistent Storage: Store and manage reminders in MongoDB.
  Edit/Delete Reminders: Modify or remove reminders as needed.
  Secure Credentials: Use .env to store sensitive email credentials.
  Responsive Interface: Works on desktop, tablet, and mobile devices.
  Future Enhancements: Optional repeat scheduling, email templates, and notifications.

🧩 PROJECT STRUCTURE

  Email-Reminder-System/
  │
  ├── node_modules/              # Installed dependencies
  ├── public/                    # Frontend files
  │   ├── index.html             # Main UI
  │   ├── style.css              # CSS styling
  │   └── script.js              # Client-side JS logic
  │
  ├── server.js                  # Express server & backend logic
  ├── .env                       # Environment variables (not pushed to GitHub)
  ├── package.json               # Project dependencies & scripts
  ├── package-lock.json          # Dependency lock file
  └── README.md                  # Project documentation
