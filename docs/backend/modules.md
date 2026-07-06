# Backend — Building NestJS Modules

This guide outlines how to construct and register a new feature module in `apps/api` using standard codebase conventions.

---

## 1. Directory Structure

Every module resides under `apps/api/src/modules/<module-name>`.

```
modules/<module-name>/
├── dto/
│   ├── create-<resource>.dto.ts
│   └── update-<resource>.dto.ts
├── entities/
│   └── <resource>.entity.ts
├── <module-name>.controller.ts
├── <module-name>.service.ts
└── <module-name>.module.ts
```

---

## 2. Conventions

### 2.1 entities
Define TypeORM entities with camelCase properties, decorated with appropriate columns:
```typescript
@Entity('my_resources')
export class MyResourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', length: 255 })
  name: string;
}
```

### 2.2 controllers
Expose endpoints with Swagger description, DTO validations, and JWT/RBAC guards.
```typescript
@ApiTags('My Module')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@Controller('my-resources')
export class MyResourcesController {
  constructor(private readonly service: MyService) {}
}
```

### 2.3 services
Contain core business logic. Database operations must be transactional if modifying multiple rows.
```typescript
@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyResourceEntity)
    private readonly repository: Repository<MyResourceEntity>,
  ) {}
}
```

### 2.4 modules
Bind everything together and export services needed by other domains.
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([MyResourceEntity])],
  controllers: [MyResourcesController],
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}
```

---

## 3. Registering the Module

### Step 1: Register in `app.module.ts`
Import and register the module class inside the `imports` array in `apps/api/src/app.module.ts`.

### Step 2: Seed initial roles/permissions
If your new endpoints require permission gates:
1. Open `packages/types/src/rbac.types.ts` and add members to the `Permission` enum (e.g. `MY_RESOURCE_CREATE = 'my_resource:create'`).
2. Open `apps/api/src/database/seed.service.ts` and add these permissions to default roles (e.g., `Admin` gets all permissions automatically, but you may want to add them to `Farmer` or `Buyer` role arrays).
