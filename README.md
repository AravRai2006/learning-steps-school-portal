# The Learning Steps Pre School Portal

A full-stack school portal built for **The Learning Steps Pre School** to give
parents a simple way to access school information and give staff an easy way
to manage it.

## About the Project

This project was developed as a real-world software project for a preschool,
rather than as a purely academic exercise.

The goal was to replace scattered or manual communication with a single
portal where parents can view information relevant to their child's class,
while school staff can manage that information through a protected admin
dashboard.

## Features

### Parent Portal

- Class selection for:
  - PG
  - Nursery
  - LKG
  - ULG
  - First Grade
- Class-specific timetables
- Class-specific assignments
- School announcements
- Parent enquiry form
- Responsive interface for desktop and mobile

### Admin Dashboard

- Protected administrator login
- Manage class timetables
- Create and update assignments
- Publish and manage announcements
- Manage information displayed on the public portal

## Technology

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** SQLite
- **Authentication:** Session-based authentication with password hashing
- **Version Control:** Git and GitHub

## How It Was Built

This project was developed using an **AI-assisted multi-agent development
workflow**.

I used different AI systems for different parts of the development process:

- **ChatGPT** — system architecture, planning, requirements, technical
  decisions, and development guidance
- **Claude** — debugging, code review, and investigating difficult issues
- **OpenAI Codex** — implementing and modifying the majority of the application
  code

I acted as the developer coordinating the workflow: defining requirements,
making architectural decisions, reviewing generated code, testing features,
debugging problems, and deciding which changes should be implemented.

The application went through multiple rounds of testing and debugging before
reaching its current working state.

## Security

The application includes several security measures, including:

- Password hashing using `scrypt`
- Protected admin routes and API endpoints
- HTTP-only session cookies
- SameSite cookie protection
- Origin checks for state-changing requests
- Parameterized SQLite queries
- Server-side input validation
- Security-related HTTP response headers
- Environment variables for sensitive configuration

No real student, parent, or staff data is included in this repository.


## What I Learned

Building this project gave me practical experience with:

- Full-stack web application architecture
- REST-style APIs
- Database-backed applications
- Authentication and authorization
- Git and GitHub
- Debugging a multi-file application
- Testing features in a real-world workflow
- Using AI as a development tool rather than simply generating isolated code

## Future Improvements

Potential future improvements include:

- Rate limiting and temporary login lockouts
- File storage for assignment attachments
- Additional administrative controls
- Further UI/UX improvements based on feedback from school staff
- Production deployment and monitoring
