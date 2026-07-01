# Git Workflow

## Branching Strategy

```
main          ← production-ready code only
└── develop   ← integration branch (optional for larger teams)
    └── feature/your-feature
    └── fix/bug-description
    └── chore/task-description
```

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/short-description` | `feature/add-farms-module` |
| Bug fix | `fix/short-description` | `fix/jwt-refresh-expiry` |
| Chore | `chore/short-description` | `chore/update-dependencies` |
| Docs | `docs/short-description` | `docs/rbac-guide` |

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`

**Examples**:
```
feat(api): add farms CRUD module
fix(web): handle 401 redirect on token expiry
chore(deps): update typeorm to 0.3.24
docs(rbac): add guard flow diagram
```

## Pull Request Checklist

- [ ] Branch is up-to-date with `main`
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] Tests added/updated for new logic
- [ ] `pnpm test` passes
- [ ] Docs updated if API shape changed
