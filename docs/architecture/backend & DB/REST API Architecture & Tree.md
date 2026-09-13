# Document 3: REST API & Declarative Security Specification

---

## 1. REST API Architecture Tree

```
/api
├── /auth
│   ├── POST /login
│   └── POST /register
├── /users
│   ├── GET /me
│   ├── GET /me/workspaces
│   └── GET /search?q=&excludeWorkspaceId=
├── /admin/users
│   └── GET /unassigned
├── /workspaces
│   ├── POST /
│   ├── GET /
│   ├── GET /{workspaceId}
│   ├── PUT /{workspaceId}
│   ├── DELETE /{workspaceId}
│   ├── /members
│   │   ├── GET /{workspaceId}/members
│   │   ├── POST /{workspaceId}/members
│   │   ├── PUT /{workspaceId}/members/{userId}
│   │   ├── PUT /{workspaceId}/members/{userId}/boards
│   │   └── DELETE /{workspaceId}/members/{userId}
│   └── /boards
│       ├── GET /{workspaceId}/boards
│       └── POST /{workspaceId}/boards
├── /boards
│   ├── GET /{boardId}
│   ├── PUT /{boardId}
│   ├── DELETE /{boardId}
│   ├── GET /{boardId}/members
│   ├── /columns
│   │   ├── POST /{boardId}/columns
│   │   └── PATCH /{boardId}/columns/reorder
│   ├── /transitions
│   │   ├── GET /{boardId}/transitions
│   │   └── PUT /{boardId}/transitions
│   └── /activity
│       └── GET /{boardId}/activity
├── /columns
│   ├── PUT /{columnId}
│   └── DELETE /{columnId}
├── /tasks
│   ├── POST /
│   ├── GET /{taskId}
│   ├── PATCH /{taskId}/move
│   ├── PATCH /{taskId}/metadata
│   ├── PATCH /{taskId}/assignee
│   ├── POST /{taskId}/approve
│   ├── POST /{taskId}/reject
│   ├── DELETE /{taskId}
│   └── GET /{taskId}/history
└── /audit-logs
    └── GET /

```

---

## 2. Authentication & Tenant Session Endpoints (`/api/auth`)

### `POST /api/auth/login`

* **Access Level:** Anonymous (Public)
* **Functional Scope:** Validates user credentials and issues a signed JWT containing identity and workspace authority claims.


* **Request Payload:**

```json
{
  "email": "dev@valeo.com",
  "password": "password123"
}

```

* **Response (HTTP 200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": 3,
    "email": "dev@valeo.com",
    "firstName": "Mohanad",
    "lastName": "Emad"
  }
}

```

---

## 3. Workspace & Membership Endpoints (`/api/workspaces`)

### `POST /api/workspaces`

* **Access Level:** `hasRole('ROLE_ADMIN')`

* **Request Payload:**

```json
{
  "name": "Autonomous Driving Systems",
  "slug": "valeo-ads",
  "description": "Perception & Trajectory Planning"
}

```

* **Response (HTTP 201 Created):** Created workspace aggregate.

### `GET /api/workspaces`

* **Access Level:** `isAuthenticated()`
* **Response (HTTP 200 OK):**

```json
[
  {
    "id": 1,
    "name": "Driving Assistance Research",
    "slug": "valeo-dar",
    "currentUserRole": "ROLE_DEVELOPER"
  }
]

```

### `GET /api/workspaces/{workspaceId}`

* **Access Level:** `@workspaceSecurity.hasAccess(#workspaceId, principal)`

* **Response (HTTP 200 OK):**

```json
{
  "id": 1,
  "name": "Driving Assistance Research",
  "slug": "valeo-dar",
  "description": "ADAS & Autonomous Vision Platforms",
  "boardCount": 3,
  "memberCount": 12
}

```

### `PUT /api/workspaces/{workspaceId}`

* **Access Level:** `@workspaceSecurity.isAdmin(#workspaceId, principal)`

* **Request Payload:**

```json
{
  "name": "Driving Assistance & Automation",
  "description": "Updated organizational scope"
}

```

* **Response (HTTP 200 OK):** Updated workspace details.

### `DELETE /api/workspaces/{workspaceId}`

* **Access Level:** `hasRole('ROLE_ADMIN')`

* **Query Parameters:** `?cascade=true`

* **Response (HTTP 204 No Content):** Deletes workspace and cascades deletion to all child boards and tasks.



### `GET /api/workspaces/{workspaceId}/members`

* **Access Level:** `@workspaceSecurity.hasAccess(#workspaceId, principal)`

* **Board chips:** `boards` lists the member's explicit board memberships, limited to boards the *caller* may open. `allBoards` is `true` for Project Managers, who open every board without memberships.

* **Response (HTTP 200 OK):**

```json
[
  {
    "membershipId": 3,
    "workspaceId": 1,
    "userId": 3,
    "email": "dev@valeo.com",
    "firstName": "Mohanad",
    "lastName": "Emad",
    "role": "ROLE_DEVELOPER",
    "joinedAt": "2026-08-01T09:00:00Z",
    "allBoards": false,
    "boards": [ { "id": 1, "title": "Core Platform Roadmap" } ]
  }
]

```

### `POST /api/workspaces/{workspaceId}/members`

* **Access Level:** `@workspaceSecurity.isAdmin(#workspaceId, principal)`

* **Request Payload:**

```json
{
  "userId": 4,
  "role": "ROLE_QA_TESTER"
}

```

* **Response (HTTP 201 Created):**

```json
{
  "membershipId": 18,
  "workspaceId": 1,
  "userId": 4,
  "role": "ROLE_QA_TESTER"
}

```

* **Errors:** `409 Conflict` if the user is already a member; `400 Bad Request` for an unknown role.

### `PUT /api/workspaces/{workspaceId}/members/{userId}`

* **Access Level:** Global admin, or a Project Manager of the workspace

* **Request Payload:** `{ "role": "ROLE_VIEWER" }`

* **Side effect:** Demoting a Project Manager removes their access to every board they are not an explicit member of; their tasks on those boards are unassigned.

* **Response (HTTP 200 OK):** a membership change (see below).

### `PUT /api/workspaces/{workspaceId}/members/{userId}/boards`

* **Access Level:** `@workspaceSecurity.isAdmin(#workspaceId, principal)` (global admin or workspace PM)

* **Functional Scope:** Replaces the member's board memberships with exactly the given boards. Tasks assigned to them on boards they lose are unassigned in the same transaction, each with a `TASK_AUTO_UNASSIGNED` audit entry.

* **Request Payload:** `{ "boardIds": [1, 4] }` (an empty list removes every board)

* **Errors:** `400 Bad Request` when the target is a Project Manager (they already see every board) or a board belongs to another workspace.

* **Response (HTTP 200 OK):** a membership change:

```json
{
  "member": { "userId": 3, "role": "ROLE_DEVELOPER", "allBoards": false, "boards": [ { "id": 1, "title": "Core Platform Roadmap" } ] },
  "unassignedTaskCount": 2
}

```

### `DELETE /api/workspaces/{workspaceId}/members/{userId}`

* **Access Level:** `@workspaceSecurity.isAdmin(#workspaceId, principal)`

* **Functional Scope:** Revokes workspace membership. The user's board memberships in the workspace are removed by the database cascade, and their tasks there are unassigned first.

* **Response (HTTP 200 OK):** `{ "member": null, "unassignedTaskCount": 1 }`

### `GET /api/workspaces/{workspaceId}/boards`

* **Access Level:** `@workspaceSecurity.hasAccess(#workspaceId, principal)`

* **Functional Scope:** Lists only the boards the caller may open: all of them for the global admin and Project Managers, and their board memberships for everyone else. Board summaries carry no columns.



---

## 3b. Users & Onboarding Endpoints (`/api/users`, `/api/admin/users`, `/api/auth/register`)

### `POST /api/auth/register`

* **Access Level:** Anonymous (Public)

* **Functional Scope:** Creates an account and signs it in. The new user belongs to no workspace until an admin or PM adds them.

### `GET /api/users/me`

* **Access Level:** `isAuthenticated()`

* **Response (HTTP 200 OK):** `{ "id": 3, "email": "dev@valeo.com", "firstName": "Mohanad", "lastName": "Emad", "isAdmin": false }`

### `GET /api/users/me/workspaces`

* **Access Level:** `isAuthenticated()`

* **Functional Scope:** The caller's workspaces with their role in each. The global admin receives every workspace, with `currentUserRole: null` where it is not a member.

### `GET /api/users/search?q={text}&excludeWorkspaceId={id}`

* **Access Level:** `hasRole('ROLE_ADMIN') or (#excludeWorkspaceId != null and @workspaceSecurity.isAdmin(#excludeWorkspaceId, principal))`

* **Functional Scope:** Finds registered users by name or email (at least 2 characters, at most 20 results, LIKE wildcards escaped). Leaves out global admins and, when given, existing members of `excludeWorkspaceId`.

### `GET /api/admin/users/unassigned`

* **Access Level:** `hasRole('ROLE_ADMIN')`

* **Functional Scope:** Registered users with no workspace membership, newest first, for the admin onboarding page.



---

## 4. Board & Column Layout Endpoints (`/api/boards` & `/api/columns`)

> **Board access rule** (`BoardAccessService`): a board can be opened by the global admin, by a Project Manager of its workspace, or by a workspace member with an explicit board membership. `@boardSecurity.canReadBoard`, `canReadTask`, `canCreateTaskOnBoard` and every `@taskSecurity` check apply this rule first.

### `GET /api/boards/{boardId}/members`

* **Access Level:** `@boardSecurity.canReadBoard(#boardId, principal)`

* **Functional Scope:** People who may be assigned tasks on the board: its explicit members plus the workspace's Project Managers. Task creation and assignment reject any other assignee with `400 Bad Request`.

### `GET /api/boards/{boardId}`

* **Access Level:** `@boardSecurity.canReadBoard(#boardId, principal)`

* **Response (HTTP 200 OK):** Assembled aggregate using the Two-Query Cartesian-safe pattern:

```json
{
  "id": 1,
  "workspaceId": 1,
  "title": "Core Platform Roadmap",
  "description": "Q3 Engineering Deliverables",
  "columns": [
    {
      "id": 1,
      "name": "To-Do",
      "position": 1000.0,
      "isGated": false,
      "tasks": [
        {
          "id": 501,
          "title": "Implement Stb_image Parser",
          "priority": "HIGH",
          "status": "ACTIVE",
          "position": 1000.0,
          "assignee": { "id": 3, "firstName": "Mohanad" },
          "version": 0
        }
      ]
    }
  ]
}

```

### `PUT /api/boards/{boardId}`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`

* **Request Payload:**

```json
{
  "title": "Core Platform Roadmap - Sprint 4",
  "description": "Updated sprint target"
}

```

* **Response (HTTP 200 OK):** Updated board metadata.

### `DELETE /api/boards/{boardId}`

* **Access Level:** `hasRole('ROLE_ADMIN')`

* **Response (HTTP 204 No Content):** Executes database-level cascade on columns and tasks.



### `POST /api/boards/{boardId}/columns`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`

* **Request Payload:**

```json
{
  "name": "Integration Testing",
  "position": 3500.0,
  "isGated": false,
  "wipLimit": 6
}

```

* **Response (HTTP 201 Created):** Created column entity.

### `PATCH /api/boards/{boardId}/columns/reorder`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`

* **Request Payload:**

```json
{
  "columnId": 3,
  "newPosition": 1500.0
}

```

* **Response (HTTP 200 OK):** Column list ordered by position.



### `PUT /api/columns/{columnId}`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`

* **Request Payload:**

```json
{
  "name": "Code Review & Quality Check",
  "isGated": false,
  "wipLimit": 4
}

```

* **Response (HTTP 200 OK):** Updated column details.

### `DELETE /api/columns/{columnId}`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`

* **Response:**
* `HTTP 204 No Content` (When column is empty and unreferenced).


* `HTTP 409 Conflict` (If active tasks exist or column is referenced in `workflow_transitions`).





---

## 5. Workflow State Machine Matrix (`/api/boards/{boardId}/transitions`)

### `GET /api/boards/{boardId}/transitions`

* **Access Level:** `@boardSecurity.canReadBoard(#boardId, principal)`

* **Response (HTTP 200 OK):**

```json
[
  {
    "id": 1,
    "fromColumnId": 1,
    "toColumnId": 2,
    "fallbackColumnId": null,
    "requiresApproval": false
  },
  {
    "id": 3,
    "fromColumnId": 3,
    "toColumnId": 4,
    "fallbackColumnId": 2,
    "requiresApproval": true
  }
]

```

### `PUT /api/boards/{boardId}/transitions`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`

* **Request Payload (Full Matrix Replacement):**

```json
[
  {
    "fromColumnId": 1,
    "toColumnId": 2,
    "fallbackColumnId": null,
    "requiresApproval": false
  },
  {
    "fromColumnId": 2,
    "toColumnId": 3,
    "fallbackColumnId": null,
    "requiresApproval": false
  },
  {
    "fromColumnId": 3,
    "toColumnId": 4,
    "fallbackColumnId": 2,
    "requiresApproval": true
  },
  {
    "fromColumnId": 4,
    "toColumnId": 5,
    "fallbackColumnId": 2,
    "requiresApproval": true
  },
  {
    "fromColumnId": 4,
    "toColumnId": 2,
    "fallbackColumnId": null,
    "requiresApproval": false
  }
]

```

* **Response (HTTP 200 OK):** Persisted transition rules array.

---

## 6. Task Management & Gating Endpoints (`/api/tasks`)

### `POST /api/tasks`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_DEVELOPER', 'ROLE_QA_TESTER')`

* **Request Payload:**

```json
{
  "boardId": 1,
  "columnId": 1,
  "title": "Implement Cipher Block Chaining",
  "description": "Integrate Dynamic S-Box with CBC mode in C++ core",
  "priority": "HIGH",
  "position": 1000.0,
  "assigneeId": 3,
  "dueDate": "2026-09-10T18:00:00Z",
  "tags": ["Crypto", "C++"]
}

```

* **Response (HTTP 201 Created):**

```json
{
  "id": 502,
  "boardId": 1,
  "columnId": 1,
  "title": "Implement Cipher Block Chaining",
  "description": "Integrate Dynamic S-Box with CBC mode in C++ core",
  "priority": "HIGH",
  "status": "ACTIVE",
  "position": 1000.0,
  "assignee": { "id": 3, "firstName": "Mohanad" },
  "createdBy": { "id": 3, "firstName": "Mohanad" },
  "version": 0,
  "createdAt": "2026-08-25T17:00:00Z"
}

```

### `GET /api/tasks/{taskId}`

* **Access Level:** `@boardSecurity.canReadTask(#taskId, principal)`

* **Response (HTTP 200 OK):** Full task details, metadata, priority, tags, status, and rejection reason if applicable.



### `PATCH /api/tasks/{taskId}/move`

* **Access Level:** `@taskSecurity.canMoveCard(#taskId, principal)`

* **Request Payload:**

```json
{
  "targetColumnId": 4,
  "newPosition": 2500.0,
  "adminBypass": false,
  "version": 0
}

```

* **Response (HTTP 200 OK):**

```json
{
  "id": 502,
  "columnId": 4,
  "position": 2500.0,
  "status": "PENDING_APPROVAL",
  "version": 1,
  "updatedAt": "2026-08-25T17:05:00Z"
}

```

* **Error Responses:**
* `HTTP 400 Bad Request`: `{ "error": "INVALID_TRANSITION", "message": "Transition from To-Do to Done is not permitted." }`

* `HTTP 409 Conflict`: `{ "error": "OPTIMISTIC_LOCK_FAILURE", "message": "Task state was updated concurrently." }`

* `HTTP 423 Locked`: `{ "error": "TASK_LOCKED", "message": "Card is locked pending manager approval." }`




### `PATCH /api/tasks/{taskId}/metadata`

* **Access Level:** `@taskSecurity.canEditCard(#taskId, principal)`

* **Request Payload:**

```json
{
  "title": "Implement Cipher Block Chaining (Refined)",
  "description": "Expanded cryptographic test criteria",
  "priority": "URGENT",
  "dueDate": "2026-09-12T18:00:00Z",
  "tags": "Crypto,C++,Security",
  "version": 1
}

```

* **Response (HTTP 200 OK):** Updated task entity with `version: 2`.



### `PATCH /api/tasks/{taskId}/assignee`

* **Access Level:** `@taskSecurity.canAssignCard(#taskId, principal)`

* **Request Payload:**

```json
{
  "assigneeId": 4,
  "version": 2
}

```

* **Response (HTTP 200 OK):** Updated task entity with `version: 3`.



### `POST /api/tasks/{taskId}/approve`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_QA_TESTER')`

* **Request Payload:**

```json
{
  "version": 1
}

```

* **Response (HTTP 200 OK):**

```json
{
  "id": 502,
  "status": "ACTIVE",
  "rejectionReason": null,
  "version": 2,
  "updatedAt": "2026-08-25T17:10:00Z"
}

```

### `POST /api/tasks/{taskId}/reject`

* **Access Level:** `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER', 'ROLE_QA_TESTER')`

* **Request Payload:**

```json
{
  "fallbackColumnId": 2,
  "rejectionReason": "Dynamic S-Box generation failed boundary test on IV initialization.",
  "version": 1
}

```

* **Response (HTTP 200 OK):**

```json
{
  "id": 502,
  "columnId": 2,
  "status": "ACTIVE",
  "rejectionReason": "Dynamic S-Box generation failed boundary test on IV initialization.",
  "version": 2,
  "updatedAt": "2026-08-25T17:12:00Z"
}

```

### `DELETE /api/tasks/{taskId}`

* **Access Level:** `@taskSecurity.canDeleteCard(#taskId, principal)`

* **Response (HTTP 204 No Content):** Removes task entity.



### `GET /api/tasks/{taskId}/history`

* **Access Level:** `@boardSecurity.canReadTask(#taskId, principal)`

* **Response (HTTP 200 OK):** Card-specific historical transitions and feedback events.



---

## 7. Compliance & Observability Endpoints (`/api/audit-logs` & `/api/boards/{id}/activity`)

### `GET /api/boards/{boardId}/activity`

* **Access Level:** `@boardSecurity.canReadBoard(#boardId, principal)`

* **Query Parameters:** `?limit=20&offset=0`
* **Response (HTTP 200 OK):** Contextual activity stream for side-panel rendering:



```json
[
  {
    "id": 1001,
    "actor": { "id": 3, "firstName": "Mohanad", "lastName": "Emad" },
    "actionType": "CARD_MOVED",
    "sourceColumnName": "Code Review",
    "targetColumnName": "Ready for QA",
    "taskTitle": "Implement Cipher Block Chaining",
    "timestamp": "2026-08-25T17:05:00Z"
  }
]

```

### `GET /api/audit-logs`

* **Access Level:** `hasRole('ROLE_ADMIN')`

* **Query Parameters:** `?page=0&size=50&actionType=GATE_REJECTED`
* **Response (HTTP 200 OK):** Global paginated audit records for PrimeNG `p-table`:



```json
{
  "content": [
    {
      "id": 1002,
      "workspaceId": 1,
      "boardId": 1,
      "taskId": 502,
      "actorId": 4,
      "actionType": "GATE_REJECTED",
      "sourceColumnId": 4,
      "targetColumnId": 2,
      "details": "{\"reason\":\"Dynamic S-Box boundary test failed\"}",
      "timestamp": "2026-08-25T17:12:00Z"
    }
  ],
  "totalElements": 240,
  "totalPages": 5
}

```