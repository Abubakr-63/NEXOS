import {
  Module,
  Injectable,
  Inject,
  Controller,
  Get,
  Post,
  Patch,
  ConflictException,
  Delete,
  Body,
  Query,
  Req,
  Res,
  Param,
  Catch,
  HttpException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  type ExceptionFilter,
  type ArgumentsHost,
  type OnModuleDestroy,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaClient, Prisma } from "@prisma/client";
import type { FastifyRequest, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";
import {
  romConfigurationSchema,
  saveConfigurationSchema,
  validateConfiguration,
  registrationSchema,
  loginSchema,
  catalogQuerySchema,
} from "@rom-hub/contracts";
import { ZodError } from "zod";
import { hashPassword, verifyPassword, sessionDigest } from "./security";

@Injectable()
export class Database extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
const publicUser = {
  id: true,
  username: true,
  role: true,
  emailVerifiedAt: true,
} as const;
const cookieName = "romhub_session";
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    let status = 500;
    let message: unknown = "An unexpected error occurred.";
    if (error instanceof ZodError) {
      status = 400;
      message = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      status = 409;
      message = "That account or resource already exists.";
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      status = 503;
      message = "Database unavailable. Try again later.";
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "request.error",
          error: error instanceof Error ? error.name : "unknown",
        }),
      );
    reply.status(status).send({
      error: {
        status,
        message,
        requestId: host.switchToHttp().getRequest<FastifyRequest>().id,
      },
    });
  }
}
@Injectable()
export class Accounts {
  constructor(@Inject(Database) private readonly db: Database) {}
  assertOrigin(req: FastifyRequest) {
    if (
      req.headers.origin !== (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    )
      throw new ForbiddenException("Invalid request origin");
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw new ForbiddenException("JSON content type required");
  }
  async user(req: FastifyRequest) {
    const token = req.cookies[cookieName];
    if (!token) throw new UnauthorizedException("Sign in to continue");
    const session = await this.db.session.findUnique({
      where: { tokenHash: sessionDigest(token) },
      include: { user: { select: publicUser } },
    });
    if (!session || session.expiresAt <= new Date())
      throw new UnauthorizedException("Session expired");
    return session.user;
  }
  async createSession(
    userId: string,
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const token = randomBytes(32).toString("base64url");
    const oldToken = req.cookies[cookieName];
    await this.db.$transaction(async (tx) => {
      if (oldToken)
        await tx.session.deleteMany({
          where: { tokenHash: sessionDigest(oldToken) },
        });
      await tx.session.create({
        data: {
          userId,
          tokenHash: sessionDigest(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      await tx.auditLog.create({
        data: { actorId: userId, action: "session.created" },
      });
    });
    reply.setCookie(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
  }
}
@ApiTags("Accounts")
@Controller("auth")
class AuthController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Accounts) private readonly accounts: Accounts,
  ) {}
  @Post("register")
  @ApiOperation({
    summary:
      "Register and establish a cookie session (email verification pending)",
  })
  async register(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.accounts.assertOrigin(req);
    const input = registrationSchema.parse(body);
    const user = await this.db.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash: await hashPassword(input.password),
      },
      select: publicUser,
    });
    await this.accounts.createSession(user.id, req, reply);
    return { user };
  }
  @Post("login")
  async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.accounts.assertOrigin(req);
    const input = loginSchema.parse(body);
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    });
    // Run scrypt even for unknown accounts to reduce account enumeration by timing.
    const hash =
      user?.passwordHash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
    if (!(await verifyPassword(input.password, hash)) || !user)
      throw new UnauthorizedException("Invalid email or password");
    await this.accounts.createSession(user.id, req, reply);
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }
  @Get("me")
  async me(@Req() req: FastifyRequest) {
    return { user: await this.accounts.user(req) };
  }
  @Post("logout")
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    this.accounts.assertOrigin(req);
    const token = req.cookies[cookieName];
    if (token)
      await this.db.session.deleteMany({
        where: { tokenHash: sessionDigest(token) },
      });
    reply.clearCookie(cookieName, { path: "/" });
    return { success: true };
  }
  @Get("sessions")
  async sessions(@Req() req: FastifyRequest) {
    const user = await this.accounts.user(req);
    return {
      items: await this.db.session.findMany({
        where: { userId: user.id, expiresAt: { gt: new Date() } },
        select: { id: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  @Delete("sessions/:id")
  async revoke(@Param("id") id: string, @Req() req: FastifyRequest) {
    this.accounts.assertOrigin(req);
    const user = await this.accounts.user(req);
    await this.db.session.deleteMany({ where: { id, userId: user.id } });
    return { success: true };
  }
}
@ApiTags("Catalog")
@Controller()
class CatalogController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Accounts) private readonly accounts: Accounts,
  ) {}
  @Get("health")
  health() {
    return { status: "ok", service: "rom-hub-api" };
  }
  @Get("ready")
  async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
  @Get("devices")
  async devices(@Query() query: unknown) {
    const { q, page, limit } = catalogQuerySchema.parse(query);
    const where: Prisma.DeviceWhereInput = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { codename: { contains: q, mode: "insensitive" } },
      ],
    };
    const [items, total] = await this.db.$transaction([
      this.db.device.findMany({
        where,
        include: { manufacturer: true, variants: true },
        orderBy: { id: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.device.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  @Get("legacy/catalog-projects")
  async projects(@Query() query: unknown) {
    const { q, kind, page, limit } = catalogQuerySchema.parse(query);
    const where: Prisma.ProjectWhereInput = {
      kind,
      name: { contains: q, mode: "insensitive" },
    };
    const [items, total] = await this.db.$transaction([
      this.db.project.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.project.count({ where }),
    ]);
    return { items, total, page, limit };
  }
  @Get("legacy/catalog-projects/:slug")
  async project(@Param("slug") slug: string) {
    const project = await this.db.project.findUnique({
      where: { slug },
      include: {
        releases: { where: { status: "PUBLISHED" } },
        devices: { include: { device: true } },
      },
    });
    if (!project) throw new NotFoundException("Project not found");
    return { project };
  }
  @Get("admin/audit")
  async audit(@Req() req: FastifyRequest) {
    const user = await this.accounts.user(req);
    if (user.role !== "ADMIN")
      throw new ForbiddenException("Administrator role required");
    return {
      items: await this.db.auditLog.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
}

@ApiTags("ROM projects")
@Controller("projects")
class ROMProjectsController {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(Accounts) private readonly accounts: Accounts,
  ) {}
  private async owned(id: string, req: FastifyRequest) {
    const user = await this.accounts.user(req);
    const project = await this.db.rOMProject.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }
  @Get()
  async list(@Req() req: FastifyRequest) {
    const user = await this.accounts.user(req);
    return {
      items: await this.db.rOMProject.findMany({
        where: { ownerId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    };
  }
  @Post()
  async create(@Body() body: unknown, @Req() req: FastifyRequest) {
    this.accounts.assertOrigin(req);
    const user = await this.accounts.user(req);
    const configuration = romConfigurationSchema.parse(body);
    return this.db.rOMProject.create({
      data: {
        ownerId: user.id,
        configuration,
        revisions: { create: { number: 1, configuration } },
      },
    });
  }
  @Get(":id")
  async get(@Param("id") id: string, @Req() req: FastifyRequest) {
    return this.owned(id, req);
  }
  @Patch(":id")
  async save(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    this.accounts.assertOrigin(req);
    const project = await this.owned(id, req);
    const { configuration, revision } = saveConfigurationSchema.parse(body);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.rOMProject.updateMany({
        where: { id, ownerId: project.ownerId, revision },
        data: { configuration, revision: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException(
          "Project changed in another tab. Reload before saving.",
        );
      await tx.configurationRevision.create({
        data: { projectId: id, number: revision + 1, configuration },
      });
      return tx.rOMProject.findUniqueOrThrow({ where: { id } });
    });
  }
  @Get(":id/revisions")
  async revisions(@Param("id") id: string, @Req() req: FastifyRequest) {
    await this.owned(id, req);
    return {
      items: await this.db.configurationRevision.findMany({
        where: { projectId: id },
        orderBy: { number: "desc" },
        take: 50,
      }),
    };
  }
  @Post(":id/validate")
  async validate(@Param("id") id: string, @Req() req: FastifyRequest) {
    this.accounts.assertOrigin(req);
    const project = await this.owned(id, req);
    const configuration = romConfigurationSchema.parse(project.configuration);
    const variant = await this.db.deviceVariant.findUnique({
      where: { id: configuration.variantId },
    });
    return validateConfiguration(configuration, Boolean(variant));
  }
  @Post(":id/builds")
  async build(@Param("id") id: string, @Req() req: FastifyRequest) {
    await this.validate(id, req);
    throw new ServiceUnavailableException(
      "Build unavailable: no verified manifest or isolated Android worker is configured.",
    );
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
  controllers: [AuthController, CatalogController, ROMProjectsController],
  providers: [
    Database,
    Accounts,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
