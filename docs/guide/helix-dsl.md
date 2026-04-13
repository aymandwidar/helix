# Helix DSL Reference

The Helix DSL is a declarative language for describing your application's data model, business logic, and UI. Files use the `.helix` extension.

## Strands (Data Models)

A `strand` defines a data model — equivalent to a database table.

```helix
strand User {
  field id: Int @id @default(autoincrement())
  field name: String
  field email: String @unique
  field role: String = "user"
  field bio: String?
  field createdAt: DateTime @default(now())

  relation posts: [Post]
}
```

### Field Types

| Type | Prisma Type | Notes |
|---|---|---|
| `String` | `String` | |
| `Int` | `Int` | |
| `Float` | `Float` | |
| `Boolean` | `Boolean` | |
| `DateTime` | `DateTime` | |
| `Json` | `Json` | |
| `[Type]` | Relation list | e.g. `[Post]` |

### Field Modifiers

| Modifier | Description |
|---|---|
| `@id` | Primary key |
| `@unique` | Unique constraint |
| `@default(value)` | Default value |
| `?` suffix | Optional field |
| `= "value"` | Default string value |

## Enums

```helix
enum Status {
  ACTIVE
  PAUSED
  COMPLETED
}
```

## Relations

```helix
strand Post {
  field id: Int @id @default(autoincrement())
  field title: String
  field authorId: Int

  relation author: User
  relation tags: [Tag]
}
```

Helix automatically generates the correct Prisma `@relation` directives based on field names.

## Strategies (Business Logic)

Strategies define AI-driven behavior and validation rules.

```helix
strategy ContentModeration {
  when "User posts content"
  then "Scan for policy violations"
  fallback "Flag for manual review"
}
```

Or inline:

```helix
strategy AutoAssign: assign -> notify-team
```

## Views (UI Pages)

Views describe the UI pages to generate for each strand.

```helix
view UserDashboard {
  strand: User
  layout: dashboard
  components: [table, form, chart]
  route: /users
}
```

### Layout Options
- `dashboard` — sidebar + content area
- `gallery` — image grid
- `feed` — scrollable list
- `kanban` — drag-and-drop columns

### Component Options
- `table` — data table with sorting and pagination
- `form` — create/edit form
- `chart` — analytics chart
- `card` — card grid

## Auth Block

Add authentication to your app:

```helix
auth {
  provider: credentials
  roles: [admin, user]
}
```

Supported providers: `credentials`, `google`, `github`.

## Complete Example

```helix
enum Priority {
  LOW
  MEDIUM
  HIGH
}

strand Project {
  field id: Int @id @default(autoincrement())
  field name: String
  field description: String?
  field status: String = "active"
  field createdAt: DateTime @default(now())

  relation tasks: [Task]
  relation members: [User]
}

strand Task {
  field id: Int @id @default(autoincrement())
  field title: String
  field completed: Boolean = false
  field priority: Priority
  field dueDate: DateTime?

  relation project: Project
  relation assignee: User
}

strand User {
  field id: Int @id @default(autoincrement())
  field name: String
  field email: String @unique
  field role: String = "user"
}

auth {
  provider: credentials
  roles: [admin, user]
}

view ProjectBoard {
  strand: Project
  layout: kanban
  components: [card, form]
  route: /projects
}

strategy PriorityAlert {
  when "Task priority is HIGH and due date is within 24 hours"
  then "Send notification to assignee"
  fallback "Log to activity feed"
}
```
