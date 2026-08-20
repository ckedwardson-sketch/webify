Personal Life Management & Planning System — Project Context
Overview
This is a long-term personal software project intended to become a comprehensive system for organizing projects, goals, responsibilities, procedures, inventory, notes, resources, and eventually selected AI-assisted administrative tasks.
The system is not intended to be a conventional notes app, task manager, or AI assistant. It is primarily a structured personal information and planning system, with notes and conventional productivity features alongside a more specialized hierarchical goal/project/progress system.
The application is expected to evolve continuously for months or years. The initial version should therefore prioritize a sound, modular foundation over attempting to implement the complete vision immediately.
The application should eventually work fully offline, including access to the user's data and local AI functionality. It should be usable from both computer and phone. In the future, a small personal server may be used to keep the system continuously available and synchronize devices, but this does not need to be implemented immediately.

Core Organizational Structure
The major sections currently envisioned are:
Goals
Projects
Progress Webs
Responsibilities
Inventory
Procedures
Notes / resources
Other conventional organizational features as development continues
These sections are related but should not be forced into one universal structure.
Goals
Goals represent relatively high-level, long-term objectives. They can be quantitative, qualitative, vague, or highly specific.
A goal may evolve substantially over time and may initially be represented only by a rough intention.
For example, a goal might eventually be something like:
Produce a specified amount of food/calories per month while meeting nutritional and cost requirements.
The goal is human-defined. The AI should never decide the user's goals.
Goals may have timelines, milestones, scaling stages, and historical versions. As a goal progresses, old stages should remain accessible so that completed history can be reviewed rather than disappearing.
Projects
Projects are the intermediate layer between goals and detailed execution.
A goal may contain a web/network of projects, and these projects may themselves change as the user thinks through how the goal can actually be achieved.
For example, a food-production goal might initially lead to projects such as:
Grow a specified quantity of grain annually
Develop grain processing capability
Establish animal feeding infrastructure
Acquire or build required equipment
These projects do not necessarily need to be completely defined immediately. A project can remain intentionally vague or act as a placeholder until the user has enough understanding to develop it further.
The user may repeatedly revise the project structure as the goal becomes better understood.
Progress Webs
Only when a project has been sufficiently developed does it become appropriate to construct a detailed progress web.
A progress web represents the concrete execution sequence of a project.
Unlike the higher-level goal/project structure, progress webs are intended to have relatively explicit task relationships.
A simple example might be:
Task A → Task B → Task C
where the relationship means that one task needs to occur before another.
The user has already developed a conceptual algorithm for automatically laying out these binary task relationships visually. In simplified terms:
Identify tasks with no prerequisites.
Place them in an initial layer.
Determine subsequent layers based on prerequisite relationships.
For a task with multiple preceding tasks, position it around the average horizontal position of those preceding tasks.
Adjust/stagger positioning based on its relationships to maintain readability.
Continue through the dependency chain.
Completed tasks and their associated structure should remain visually understandable while unfinished work can move/reorganize upward to reduce unnecessary spread in the web.
The web is a visualization/extension of the underlying task relationships, not the fundamental data structure. The logical relationships should remain usable independently of their visual coordinates so that the layout algorithm can change later.
Goal/project webs may be hand-crafted and considerably more complex because they represent long-term thinking and may take months or years to develop. They should not be treated as ordinary task dependency graphs.

Task Characteristics
Tasks may contain metadata describing the type of work involved.
Examples include:
Purchase
Physical outdoor labor
Relaxed/easy task
Research
Heavy thinking/problem solving
Other categories added later
These categories should have visual distinctions such as shapes and/or colors.
The purpose is not merely decoration. The user should be able to quickly identify what type of work is available and choose tasks appropriate to their current situation.
Eventually the system may allow AI-assisted task recommendations based on project state, task type, context, and things the user is likely to overlook.
The AI should initially assist with formatting and descriptions rather than deciding the actual project structure.

Responsibilities
Responsibilities are distinct from ordinary tasks.
They represent recurring things that must be maintained or remembered, such as:
Feeding animals
Watering plants
Maintenance
Regular inspections
Other recurring obligations
The intended behavior is deliberately different from a conventional alarm.
The system should provide a gentle reminder and safety net, rather than constantly demanding attention.
If a responsibility is missed, the system should recognize that and continue gently reminding/catching the user rather than simply assuming the task disappeared.
Eventually, voice input could allow the user to say something like:
"I fed the chickens."
and have the appropriate responsibility occurrence recorded automatically.
This becomes especially important if the system eventually supports farming or other environments with many daily responsibilities where forgetting a small maintenance task could have significant consequences.

Inventory
Inventory is intended to be a living, continuously updated list rather than a catalog of every insignificant possession.
It should primarily contain items above a user-defined value threshold or items that are important enough to track regardless of monetary value.
The long-term purpose is twofold:
Help the user keep track of physical possessions.
Give the AI useful contextual knowledge about what resources, equipment, materials, and tools are actually available.
This allows the system to eventually answer questions or make suggestions using real-world context rather than treating projects as abstract lists.
Inventory will likely eventually need to record changes such as acquisition, movement, repair, loss, sale, etc., but the exact implementation does not need to be finalized initially.

Notes, Procedures, and Resources
These areas can remain relatively conventional.
The application should support normal note-taking, folders/organization, procedures, recipes, reference material, and project-associated information.
The important difference is that these conventional objects can eventually be connected to the structured parts of the system.
For example, a procedure, note, inventory item, or external resource could provide context for a project without becoming part of the project's actual dependency web.

AI Philosophy
AI is an assistive layer, not the authority over the user's life or planning system.
The AI should not independently modify or decide the user's goals or high-level project webs.
The intended progression is:
User designs and operates the system manually.
Repetitive or annoying administrative patterns become apparent.
The user models those patterns explicitly.
AI is gradually given responsibility for specific, well-defined operations.
The user remains able to supervise and override the AI.
Examples of appropriate AI responsibilities include:
Generating straightforward task descriptions from the user's ideas
Formatting information
Turning rough instructions into consistent saved instructions
Updating repetitive administrative information
Helping search and retrieve relevant resources
Identifying potentially forgotten routine work
Suggesting tasks based on existing project information
Eventually interpreting voice commands
Helping maintain responsibilities and other repetitive records
The amount of assumption made by AI should be controllable by a user setting. AI-generated descriptions should be human-supervised, especially as the system develops.
The underlying application must remain fully functional without AI. AI should enhance the system rather than become a dependency for basic operation.

Privacy and Local AI
Personal information about daily habits, projects, responsibilities, possessions, and long-term plans should not need to be sent to external AI servers.
The long-term AI architecture should therefore support local models.
When the AI is queried, the application should eventually collect the relevant information/context needed for that specific operation and provide it to the local model rather than exposing the entire personal database unnecessarily.
The AI should therefore function as a controlled interface to the user's structured data.

Offline and Synchronization Philosophy
Full offline operation is a long-term requirement.
The application should remain usable without an internet connection, including access to the user's core data and eventually local AI capabilities.
The eventual desired architecture is roughly:
Primary computer/database ↔ synchronization layer ↔ phone/other devices
The computer may initially serve as the primary copy. Other devices should be able to make changes and synchronize those changes when connectivity is available.
Historical versions/backups should be retained periodically so that accidental or unwanted changes can be recovered.
A small personal server may eventually replace or supplement the primary computer as the system becomes sufficiently mature.
This synchronization architecture does not need to be implemented in the first prototype. However, the initial technology choices should avoid making fully offline operation and future synchronization unnecessarily difficult.

Development Philosophy
The application should be built incrementally.
The goal is not to finish the entire system before it becomes useful. Instead, the system should become increasingly capable while remaining functional at every stage.
The first implementation should establish:
A persistent local database
A working desktop/browser interface
Core object storage
Basic project/goal/task functionality
Progress-web relationships and visualization
Phone synchronization, local AI, voice recognition, advanced responsibility management, sophisticated inventory history, and other automation can be added progressively.
The architecture should prioritize separation between underlying data and visual presentation, modularity, local persistence, and the ability to replace or improve individual systems without rebuilding the entire application.
The system is expected to become substantially more sophisticated over time, so early simplicity should come from implementing fewer features—not from choosing an architecture that prevents later expansion.

