# Examples

Real-world prompts you can use directly with `helix spawn`.

## SaaS Applications

### Project Management Tool
```bash
helix spawn "A project management tool with Projects, Tasks, Users, and Teams. Projects have status (planning/active/done), Tasks have priority and due dates, Users belong to Teams. Include team-based access control." --theme midnight --db postgres
```

### CRM System
```bash
helix spawn "A CRM with Contacts, Companies, Deals, and Activities. Deals have stages (prospect/qualified/proposal/won/lost) and values. Track all interactions between sales reps and contacts." --theme professional --db postgres
```

### Invoice Manager
```bash
helix spawn "An invoice management system with Clients, Projects, Invoices, and LineItems. Invoices have status (draft/sent/paid/overdue) and due dates. Calculate totals automatically." --theme midnight --db sqlite
```

---

## Content Platforms

### Blog Platform
```bash
helix spawn "A blog platform with Authors, Posts, Categories, Tags, and Comments. Posts have status (draft/published/archived) and SEO metadata. Users can like and comment." --theme professional --db sqlite
```

### Knowledge Base
```bash
helix spawn "A knowledge base with Articles, Categories, Authors, and Tags. Articles have versions, view counts, and helpful ratings. Include search and related articles." --theme minimal --db sqlite
```

### Newsletter Platform
```bash
helix spawn "A newsletter platform with Subscribers, Newsletters, Campaigns, and Analytics. Track opens, clicks, and unsubscribes. Authors can schedule campaigns." --theme vibrant --db postgres
```

---

## E-commerce

### Online Store
```bash
helix spawn "An e-commerce store with Products, Categories, Orders, OrderItems, Customers, and Reviews. Products have inventory, variants (size/color), and images. Orders have status tracking." --theme vibrant --db postgres
```

### Digital Marketplace
```bash
helix spawn "A digital product marketplace with Products, Creators, Purchases, and Downloads. Products are files with prices and license types. Track revenue per creator." --theme glassmorphism --db postgres
```

---

## Internal Tools

### HR Dashboard
```bash
helix spawn "An HR management system with Employees, Departments, Leave Requests, and Performance Reviews. Track attendance, time-off balances, and performance scores." --theme professional --db sqlite
```

### Inventory System
```bash
helix spawn "A warehouse inventory system with Products, Warehouses, StockMovements, and Suppliers. Track stock levels, reorder points, and supplier lead times. Alert on low stock." --theme midnight --db postgres
```

### Support Ticket System
```bash
helix spawn "A customer support ticket system with Tickets, Customers, Agents, Teams, and Comments. Tickets have priority, status, and SLA deadlines. Agents belong to Teams." --theme professional --db sqlite
```

---

## Community Apps

### Forum
```bash
helix spawn "A community forum with Users, Categories, Threads, Posts, and Reactions. Threads have tags and view counts. Users have reputation points and badges." --theme vibrant --db sqlite
```

### Event Platform
```bash
helix spawn "An event management platform with Events, Organizers, Attendees, Tickets, and Venues. Events have capacity limits, ticket types (free/paid), and schedules." --theme sunset --db postgres
```

---

## Using Templates

For these use cases, try the built-in templates as a starting point:

```bash
helix init saas        # SaaS starter
helix init blog        # Blog platform
helix init ecommerce   # E-commerce store
helix init dashboard   # Analytics dashboard
helix init todo        # Simple task manager
```
