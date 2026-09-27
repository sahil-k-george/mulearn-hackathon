# Adaptive Student Academic Companion
## Base Implementation Plan for AI Coding Agents

> **Purpose:** Master product specification and implementation roadmap for Antigravity, OpenCode, Claude Code, Cursor, or similar AI coding agents.

---

## 0. Product Definition

### Working Name

**Adaptive**

The name can be changed later.

### Product Concept

Build a student-centric web/PWA application that converts a student's **unstructured academic workload, available time, knowledge level, goals, and current situation** into a realistic adaptive study/action plan.

The system supports:

- **Solo Mode** — personalized planning for an individual student.
- **Team Mode** — collaborative planning and peer learning.
- **Fast Prep Mode** — exam/deadline-focused preparation.
- **Keep Up Mode** — continuous learning aligned with academic progress.
- **Brain Dump** — natural-language input that extracts tasks, deadlines, knowledge gaps and commitments.
- **Adaptive Planning** — plans change when the student's available time, progress, or deadlines change.
- **Progress Tracking** — track completion, understanding and milestones.
- **Peer Learning** — identify opportunities for students to help one another.

The system should **not simply be a task manager**.

Its primary purpose is:

> **Understand the student's situation → determine what matters → create a realistic plan → help them execute it → adapt when reality changes.**

---

# 1. Product Principles

## P1 — Minimize Manual Planning

The student should not have to construct a complicated timetable manually.

Prefer:

> "Tell us what's going on."

over:

> "Fill 15 fields."

---

## P2 — Recommendations Must Be Explainable

Whenever the system prioritizes something, show a short reason.

Example:

> **Integration — 25 min**
>
> Due soon + low confidence + required for upcoming topics.

Never make the user wonder why the system chose something.

---

## P3 — Realistic Planning Over Maximum Productivity

The system should not try to fill every available minute.

It should account for:

- available time
- breaks
- existing commitments
- workload
- knowledge level
- deadlines

---

## P4 — Adaptive Instead of Static

A generated plan is not permanent.

If:

- a task is missed
- a task takes longer
- a deadline changes
- the student has less time
- the student finishes early

the system should be capable of recalculating the plan.

---

## P5 — Team Does Not Mean Identical Schedules

Team members should share:

- goals
- resources
- sessions
- progress

but retain **individual plans**.

---

# 2. MVP Scope

The MVP should contain:

### Core

- Authentication
- Student profile
- Solo Mode
- Team Mode
- Brain Dump
- Task extraction
- Subject management
- Knowledge level
- Available time
- Fast Prep
- Keep Up
- Study-plan generation
- Adaptive rescheduling
- Progress tracking
- Team creation/joining
- Team member profiles
- Basic peer-learning recommendations

### MVP Should NOT Initially Include

- sophisticated medical/mental-health diagnosis
- complex social networking
- public profiles
- gamification-heavy systems
- full document collaboration
- advanced LMS integration
- complicated calendar synchronization
- automatic lecture/video analysis
- autonomous AI agents making irreversible decisions

These can be future extensions.

---

# 3. Main Application Architecture

Use a modular architecture.

```text
                    ┌─────────────────────┐
                    │      FRONTEND       │
                    │                     │
                    │ Dashboard           │
                    │ Brain Dump          │
                    │ Planner             │
                    │ Solo Mode           │
                    │ Team Mode           │
                    │ Progress            │
                    └──────────┬──────────┘
                               │
                         API / Service
                               │
                    ┌──────────▼──────────┐
                    │     BACKEND         │
                    │                     │
                    │ Auth                │
                    │ Planning            │
                    │ Brain Dump          │
                    │ Teams               │
                    │ Progress            │
                    │ Resources           │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
             Database      AI/LLM         Scheduler
```

The exact technology stack can be chosen by the implementation agent based on the development environment.

Prioritize:

1. Simple deployment
2. Low infrastructure cost
3. Good mobile responsiveness
4. Easy local development
5. Modular backend
6. Easy future AI integration

---

# 4. Data Model

## User

```text
User
├── id
├── name
├── email
├── avatar
├── timezone
├── created_at
└── preferences
```

## Subject

```text
Subject
├── id
├── user_id
├── name
├── description
├── knowledge_level
└── created_at
```

Knowledge level:

```text
1 — Just Starting
2 — Basic Understanding
3 — Moderate
4 — Confident
5 — Strong
```

## Goal

```text
Goal
├── id
├── user_id
├── subject_id
├── mode
├── title
├── target_date
├── priority
└── status
```

Modes:

```text
FAST_PREP
KEEP_UP
```

## Task

```text
Task
├── id
├── user_id
├── subject_id
├── title
├── description
├── estimated_minutes
├── deadline
├── priority
├── knowledge_requirement
├── status
└── source
```

Possible sources:

```text
MANUAL
BRAIN_DUMP
AI_GENERATED
TEAM
```

## Study Session

```text
StudySession
├── id
├── user_id
├── task_id
├── start_time
├── duration
├── status
└── actual_duration
```

## Team

```text
Team
├── id
├── name
├── subject
├── goal
├── invite_code
├── created_by
└── created_at
```

## Team Member

```text
TeamMember
├── team_id
├── user_id
├── knowledge_level
├── role
└── joined_at
```

## Resource

```text
Resource
├── id
├── team_id
├── uploaded_by
├── title
├── type
├── url/path
└── created_at
```

---

# 5. Brain Dump Engine

This should be one of the signature features.

### Input

Natural language.

Example:

> "Maths exam Friday, haven't understood integration, physics record tomorrow and I have to finish our presentation with Arun and Neha."

### Processing

Extract:

- Tasks
- Deadlines
- Subjects
- Knowledge gaps
- People
- Team activities
- Time constraints
- Goals

Example:

```json
{
  "tasks": [
    {
      "title": "Complete physics lab record",
      "deadline": "...",
      "subject": "Physics"
    }
  ],
  "knowledge_gaps": [
    {
      "subject": "Mathematics",
      "topic": "Integration"
    }
  ],
  "collaboration": [
    {
      "activity": "Presentation",
      "members": ["Arun", "Neha"]
    }
  ]
}
```

The extracted information should be shown to the user **before it becomes permanent data**.

User should be able to:

- edit
- remove
- confirm

---

# 6. Planning Engine

The planning engine should initially be **deterministic**, even if AI is used elsewhere.

Do not make an LLM responsible for every scheduling decision.

The engine should calculate priority using factors such as:

```text
Priority =
    deadline urgency
  + knowledge gap
  + goal importance
  + prerequisite importance
  + estimated effort
  + current progress
```

The exact mathematical weighting can be tuned later.

AI can assist with:

- interpreting natural language
- breaking large goals into tasks
- generating explanations
- suggesting study techniques

But the core scheduler should remain predictable.

---

# 7. Fast Prep Mode

### Input

- Subject
- Exam / target date
- Knowledge level
- Available time
- Optional topics

### Output

- High-impact topics
- Study sessions
- Revision
- Practice
- Recall
- Mock questions

Example:

```text
FAST PREP

Mathematics
Exam: Friday

TODAY
25m — Integration fundamentals
30m — Standard problems
10m — Break
25m — Previous questions
10m — Active recall
```

---

# 8. Keep Up Mode

This mode focuses on continuous progress.

The system maintains:

```text
Current academic progress
        ↓
Student understanding
        ↓
Knowledge gaps
        ↓
Recommended catch-up
        ↓
Next topic
```

Example:

> Your class is currently studying Fourier Series.
>
> Your Integration confidence is low and it is a prerequisite.
>
> Recommended:

```text
1. Review integration — 20 min
2. Solve 5 problems — 20 min
3. Continue Fourier Series
```

---

# 9. Adaptive Planning

This is a critical MVP feature.

Every plan should have:

```text
planned_duration
actual_duration
status
```

Possible events:

```text
TASK_COMPLETED
TASK_SKIPPED
TASK_EXTENDED
TASK_SHORTENED
DEADLINE_CHANGED
TIME_AVAILABLE_CHANGED
```

After such an event:

```text
Current Plan
      ↓
Evaluate remaining workload
      ↓
Check available time
      ↓
Recalculate priorities
      ↓
Generate updated plan
```

Example:

> You planned 2 hours.
>
> You only have 75 minutes remaining.

System:

```text
75 MINUTES LEFT

1. Integration — 30m
2. Physics record — 30m
3. Quick recall — 15m

Lower-priority tasks moved to tomorrow.
```

---

# 10. Team Mode

## Create Team

```text
Team name
Subject
Goal
Target date
```

Generate:

```text
Team Code
QR Code
Invite Link
```

## Join Team

Student can:

- Enter team code
- Scan QR
- Open invite link

---

# 11. Team Knowledge Map

Each member provides their knowledge level.

Example:

```text
                 TEAM

        Integration
        ─────────────
        Arun      4/5
        Neha      2/5
        Rahul     3/5

        Differential Equations
        ───────────────────────
        Arun      2/5
        Neha      5/5
        Rahul     3/5
```

The system can identify:

### Strengths

> Neha is strong in Differential Equations.

### Gaps

> Several members need help with Integration.

### Peer-learning opportunities

> Suggested session: Neha → Differential Equations.

These should be **recommendations**, not mandatory assignments.

---

# 12. Team Planner

The team has a shared goal:

> Mathematics Internal — October 3

The system generates:

### Shared Plan

```text
MONDAY
Integration Session

TUESDAY
Differential Equations

WEDNESDAY
Practice Questions

THURSDAY
Mock Test
```

But each student gets:

### Personal Plan

```text
YOUR PLAN

20m — Integration basics
30m — Practice
15m — Peer session
20m — Recall
```

---

# 13. Dashboard

The dashboard should focus on **what to do now**, not analytics overload.

Suggested hierarchy:

```text
Good evening, Sahil.

┌───────────────────────────────┐
│ YOUR NEXT STEP                │
│                               │
│ Integration Basics            │
│ 25 minutes                    │
│                               │
│ Due soon + knowledge gap      │
│                               │
│             [ Start ]         │
└───────────────────────────────┘


TODAY
───────────────────────────────

✓ Physics Record
→ Integration
○ Maths Practice
○ Presentation


YOUR SPACES

Solo
Team: Maths Survivors
```

---

# 14. Progress

Keep analytics useful rather than decorative.

## Personal

- Tasks completed
- Study time
- Subject progress
- Knowledge confidence
- Upcoming deadlines
- Current workload

## Team

- Team progress
- Member participation
- Topic coverage
- Knowledge gaps
- Upcoming sessions

Avoid meaningless metrics such as:

> "You were 87.4% productive today."

---

# 15. Well-being / Workload Layer

Use this as a **workload-awareness system**, not a medical system.

Possible check-in:

```text
How manageable is today's workload?

○ Comfortable
○ Manageable
○ Heavy
○ Overloaded
```

If overloaded:

```text
You have 4h 20m of planned work
but approximately 2h available.

Would you like to rebalance?

[ Rebalance ]
[ Keep Plan ]
```

---

# 16. AI Architecture

The system should be **AI-assisted**, not AI-dependent.

## AI Responsibilities

Good uses:

- Natural language understanding
- Brain dump extraction
- Task decomposition
- Study strategy suggestions
- Topic explanations
- Generating summaries
- Generating quiz questions
- Explaining recommendations

## Deterministic Responsibilities

- Authentication
- Authorization
- Data persistence
- Deadline storage
- Scheduling
- Priority calculation
- Team membership
- Progress calculation
- Data validation

---

# 17. AI Provider Abstraction

Do not hard-code one AI provider throughout the application.

Create:

```text
AIService
├── OpenAIProvider
├── GeminiProvider
├── LocalProvider
└── MockProvider
```

The application should communicate through:

```text
AIService.generate(...)
AIService.extract(...)
AIService.explain(...)
```

This makes it possible to change models later.

For the first prototype, a mock provider can also be used so that the application remains functional without an API key.

---

# 18. Authentication

MVP:

- Sign Up
- Login
- Logout
- Forgot Password

Optional:

- Google Login

Do not make authentication the centerpiece of the demo.

---

# 19. Security / Privacy

Because the system contains personal academic information:

### Required

- User-specific database access
- Team authorization
- Input validation
- Protected API routes
- No exposing private team information
- Secure environment variables
- No API keys in frontend
- Proper authorization for resources

### Product Principle

Student data should not automatically become public.

---

# 20. UI/UX Direction

Design should feel:

**calm + modern + academic + intelligent**

Avoid:

- excessive gradients
- excessive glassmorphism
- giant animations
- generic AI-dashboard aesthetics
- excessive cards
- excessive icons
- meaningless charts

The UI should make the student feel:

> "I know what I should do next."

rather than:

> "Wow, there are 47 things on this dashboard."

### Responsive

Must work well on:

- desktop
- tablet
- mobile

A student should be able to use the application primarily from a phone.

---

# 21. Recommended Development Phases

Implement these phases **in order**.

## Phase 0 — Project Analysis

Agent must:

1. Inspect repository.
2. Identify existing stack.
3. Identify package manager.
4. Identify database setup.
5. Identify existing UI.
6. Identify environment configuration.
7. Do not overwrite working functionality unnecessarily.

Then produce:

```text
PROJECT ANALYSIS

Stack:
Database:
Frontend:
Backend:
Existing features:
Missing features:
Potential conflicts:
```

---

## Phase 1 — Foundation

Implement:

- application shell
- routing
- authentication
- database
- user profile
- responsive layout
- design system
- environment configuration

### Deliverable

> User can register, log in and reach an empty dashboard.

---

## Phase 2 — Subjects & Goals

Implement:

- subjects
- knowledge levels
- goals
- deadlines
- available study time

### Deliverable

> Student can establish their academic context.

---

## Phase 3 — Brain Dump

Implement:

- brain dump UI
- AI extraction layer
- extracted-information preview
- edit/confirm flow
- task creation
- deadline extraction
- knowledge-gap extraction

### Deliverable

> Student can enter messy text and turn it into structured academic information.

---

## Phase 4 — Planning Engine

Implement:

- priority calculation
- task decomposition
- Fast Prep
- Keep Up
- study sessions
- recommendation explanations

### Deliverable

> Student receives a useful personalized plan.

---

## Phase 5 — Adaptive Planning

Implement:

- task completion
- task skipping
- actual duration
- plan recalculation
- deadline changes
- available-time changes

### Deliverable

> The plan changes intelligently when reality changes.

---

## Phase 6 — Team Mode

Implement:

- create team
- join team
- invite code
- QR
- members
- shared goal
- member knowledge levels

### Deliverable

> Multiple students can work toward a shared academic objective.

---

## Phase 7 — Team Intelligence

Implement:

- team knowledge map
- strengths
- gaps
- peer-learning recommendations
- shared plan
- individual plans

### Deliverable

> The team receives useful collaborative recommendations.

---

## Phase 8 — Resources & Progress

Implement:

- shared resources
- notes
- progress tracking
- milestones
- team progress
- personal progress

Keep this deliberately lightweight.

---

## Phase 9 — Well-being / Workload

Implement:

- workload check-in
- workload calculation
- overload detection
- plan rebalance
- break recommendations

Avoid medical claims.

---

## Phase 10 — Demo Polish

Focus on:

- responsive UI
- empty states
- loading states
- error states
- animations
- accessibility
- realistic demo data
- onboarding
- mobile experience
- performance

---

# 22. Demo Scenario

The AI agent should create seeded demo data allowing this exact scenario.

### Student

```text
Name: Demo Student
Subject: Engineering Mathematics
Knowledge: 2/5
Exam: 4 days
Available tonight: 2 hours
```

Brain dump:

> "I have maths exam Friday, I haven't understood integration, physics record is due tomorrow and I need to work on the presentation with Arun and Neha."

System should demonstrate:

```text
Extraction
     ↓
Prioritization
     ↓
Plan
     ↓
Start task
     ↓
Task takes longer
     ↓
Adaptive rescheduling
     ↓
Create team
     ↓
Friends join
     ↓
Team knowledge analysis
     ↓
Peer-learning recommendation
```

This should become the **primary product demonstration**.

---

# 23. Definition of Done

The project should not be considered complete merely because pages exist.

## Functional

- [ ] User can register/login
- [ ] User can create subjects
- [ ] User can set knowledge level
- [ ] User can create goals
- [ ] User can enter brain dumps
- [ ] Brain dump becomes structured data
- [ ] User can review extracted data
- [ ] Fast Prep works
- [ ] Keep Up works
- [ ] Plans are generated
- [ ] Plans explain priorities
- [ ] Tasks can be completed
- [ ] Plans can adapt
- [ ] Teams can be created
- [ ] Teams can be joined
- [ ] Team members can provide knowledge levels
- [ ] Team knowledge map works
- [ ] Peer-learning recommendations work
- [ ] Shared goals work
- [ ] Personal plans remain individualized
- [ ] Progress is tracked
- [ ] Workload can be rebalanced

## UX

- [ ] Mobile responsive
- [ ] Accessible controls
- [ ] Clear loading states
- [ ] Clear errors
- [ ] Useful empty states
- [ ] No dead-end screens
- [ ] No placeholder buttons presented as finished functionality

## Engineering

- [ ] Environment variables documented
- [ ] Secrets excluded from Git
- [ ] API authorization implemented
- [ ] Database migrations available
- [ ] Error handling implemented
- [ ] AI provider abstracted
- [ ] Mock AI mode available
- [ ] README updated
- [ ] Setup instructions work from a clean environment

---

# 24. AI Coding Agent Instructions

Use the following instructions alongside this implementation plan when working with an AI coding agent.

> You are implementing a student-focused adaptive academic planning and collaboration platform.
>
> Treat this product implementation plan as the source of truth for product scope and architecture.

## Core Objective

Build a functional prototype that demonstrates this loop:

```text
Student brain dump
→ understand situation
→ extract academic information
→ prioritize
→ generate realistic plan
→ execute
→ track progress
→ adapt plan
```

The platform must support both:

1. Solo Mode
2. Team Mode

Team Mode must provide shared academic goals while keeping each student's study plan personalized.

## Development Rules

1. Inspect the existing repository before changing anything.
2. Do not unnecessarily replace working functionality.
3. Reuse existing dependencies and architecture where practical.
4. If the repository already has a design system, preserve and extend it rather than replacing it.
5. Keep frontend, backend, database and AI responsibilities clearly separated.
6. Do not hard-code API keys or secrets.
7. Do not make the application dependent on an AI API for basic functionality.
8. Implement deterministic fallbacks/mock data where appropriate.
9. Do not create fake functionality behind buttons.
10. Every implemented UI action should either work or be explicitly marked as unavailable during development.
11. Keep the application responsive, especially on mobile.
12. Prioritize usability over visual complexity.
13. Avoid unnecessary animations, excessive gradients, excessive glassmorphism and generic AI-dashboard styling.
14. Use meaningful loading, error and empty states.
15. Validate user input.
16. Enforce authorization on private user and team data.
17. Keep AI functionality behind an abstraction layer so the model provider can be replaced later.

## AI Responsibilities

AI may be used for:

- natural-language brain dump extraction
- task decomposition
- study strategy suggestions
- explanations
- topic summaries
- quiz generation

Do not rely on AI for:

- authentication
- authorization
- data persistence
- deadline storage
- core task state
- permissions
- deterministic scheduling calculations
- progress calculations

The scheduling system should remain predictable and explainable.

## Product Behavior

The application should prioritize:

> **"What should I do next?"**

over:

> **"Here is a large dashboard containing everything."**

Whenever possible, show:

- the next recommended action
- estimated duration
- reason for recommendation
- what comes afterward

## Development Process

Work in phases.

Before each major phase:

1. Inspect the current implementation.
2. Identify dependencies.
3. Identify potential regressions.
4. Implement the smallest complete version.
5. Test it.
6. Fix errors.
7. Update documentation.
8. Only then proceed to the next phase.

Do not jump ahead and build all features simultaneously.

## Important

Do not treat the implementation plan as permission to add unrelated features.

If a potentially useful feature is outside the current MVP, document it as a future enhancement instead of silently expanding scope.

The final application should feel like one coherent product rather than a collection of unrelated productivity features.

The core product identity is:

> **"An adaptive academic companion that turns unstructured student workload into realistic, personalized and collaborative action plans."**
