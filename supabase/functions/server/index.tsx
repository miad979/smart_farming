import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { supabase, verifyToken, hashPassword, verifyPassword, validateEmail, validatePassword } from "./auth.tsx";
import type { User, DiseaseRecord, IrrigationSchedule, Consultation, MarketPrice, PriceAlert, Device } from "./types.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-b83a1961/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== AUTHENTICATION ====================

// Sign up with email and password
app.post("/make-server-b83a1961/auth/signup", async (c) => {
  try {
    const { email, password, name, role, location, specialty, registrationNumber } = await c.req.json();

    if (!email || !password || !name || !role) {
      return c.json({ error: "Missing required fields: email, password, name, role" }, 400);
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return c.json({ error: emailValidation.error }, 400);
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({ error: passwordValidation.error }, 400);
    }

    // Check if user already exists
    const existingUsers = await kv.getByPrefix<User>(`user:email:${email}`);
    if (existingUsers.length > 0) {
      return c.json({ error: "User already exists with this email address" }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create Supabase auth user with email and password
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm for demo
      user_metadata: { 
        name, 
        role,
        location,
        specialty,
        registrationNumber
      },
    });

    if (authError || !authData.user) {
      console.error("Supabase auth error:", authError);
      return c.json({ error: authError?.message || "Failed to create auth user" }, 500);
    }

    // Create user profile in KV store
    const userId = authData.user.id;
    const user: User = {
      id: userId,
      email,
      name,
      role: role as any,
      role_bn: role === "farmer" ? "কৃষক" : role === "doctor" ? "ডাক্তার" : "অ্যাডমিন",
      location,
      location_bn: location,
      specialty,
      specialty_bn: specialty,
      verificationStatus: role === "doctor" ? "pending" : "verified",
      registrationNumber,
      createdAt: new Date().toISOString(),
      metadata: {
        passwordHash, // Store hash in metadata
      }
    };

    await kv.set(`user:${userId}`, user);
    await kv.set(`user:email:${email}`, userId);

    // If doctor, add to pending doctors list
    if (role === "doctor") {
      await kv.set(`doctor:pending:${userId}`, userId);
    }

    // Don't return password hash to client
    const userResponse = { ...user };
    delete userResponse.metadata;

    return c.json({ 
      user: userResponse,
      accessToken: authData.session?.access_token || `demo_token_${userId}`,
      message: "User created successfully" 
    });
  } catch (error) {
    console.error("Error during signup:", error);
    return c.json({ error: "Failed to sign up" }, 500);
  }
});

// Sign in with email and password
app.post("/make-server-b83a1961/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return c.json({ error: emailValidation.error }, 400);
    }

    // Get user ID from email
    const userIds = await kv.getByPrefix<string>(`user:email:${email}`);
    if (userIds.length === 0) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const userId = userIds[0];
    const user = await kv.get<User>(`user:${userId}`);

    if (!user) {
      return c.json({ error: "User profile not found" }, 404);
    }

    // Verify password
    const passwordHash = user.metadata?.passwordHash;
    if (!passwordHash) {
      return c.json({ error: "Password not set for this user" }, 400);
    }

    const isValidPassword = await verifyPassword(password, passwordHash);
    if (!isValidPassword) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    // Update last seen
    user.lastSeen = new Date().toISOString();
    await kv.set(`user:${userId}`, user);

    // Try to get Supabase session (optional)
    let accessToken = `demo_token_${userId}`;
    try {
      const { data: authData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authData?.session?.access_token) {
        accessToken = authData.session.access_token;
      }
    } catch (authError) {
      console.warn("Supabase auth failed, using demo token:", authError);
    }

    // Don't return password hash to client
    const userResponse = { ...user };
    delete userResponse.metadata;

    return c.json({ 
      user: userResponse,
      accessToken,
      message: "Signed in successfully" 
    });
  } catch (error) {
    console.error("Error during signin:", error);
    return c.json({ error: "Failed to sign in" }, 500);
  }
});

// Get current user profile
app.get("/make-server-b83a1961/auth/me", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: error || "Unauthorized" }, 401);
    }

    const user = await kv.get<User>(`user:${authUser.id}`);
    
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users (admin only)
app.get("/make-server-b83a1961/users", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (!currentUser || currentUser.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const users = await kv.getByPrefix<User>("user:");
    // Filter out internal keys like user:phone:xxx
    const filteredUsers = users.filter(u => u && u.id && !u.id.includes(":"));

    return c.json({ users: filteredUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// Update user profile
app.put("/make-server-b83a1961/users/:userId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = c.req.param("userId");
    const updates = await c.req.json();

    // Users can only update their own profile unless admin
    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (userId !== authUser.id && currentUser?.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const user = await kv.get<User>(`user:${userId}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const updatedUser = { ...user, ...updates, id: userId };
    await kv.set(`user:${userId}`, updatedUser);

    return c.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return c.json({ error: "Failed to update user" }, 500);
  }
});

// ==================== DOCTOR VERIFICATION ====================

// Get pending doctors (admin only)
app.get("/make-server-b83a1961/doctors/pending", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (!currentUser || currentUser.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const pendingDoctorIds = await kv.getByPrefix<string>("doctor:pending:");
    const doctors: User[] = [];

    for (const doctorId of pendingDoctorIds) {
      const doctor = await kv.get<User>(`user:${doctorId}`);
      if (doctor) {
        doctors.push(doctor);
      }
    }

    return c.json({ doctors });
  } catch (error) {
    console.error("Error fetching pending doctors:", error);
    return c.json({ error: "Failed to fetch pending doctors" }, 500);
  }
});

// Verify or reject doctor (admin only)
app.post("/make-server-b83a1961/doctors/:doctorId/verify", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (!currentUser || currentUser.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const doctorId = c.req.param("doctorId");
    const { status, reason } = await c.req.json();

    if (!["verified", "rejected"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    const doctor = await kv.get<User>(`user:${doctorId}`);
    if (!doctor) {
      return c.json({ error: "Doctor not found" }, 404);
    }

    doctor.verificationStatus = status;
    if (reason) {
      doctor.metadata = { ...doctor.metadata, rejectionReason: reason };
    }

    await kv.set(`user:${doctorId}`, doctor);

    // Remove from pending list
    await kv.del(`doctor:pending:${doctorId}`);

    if (status === "verified") {
      await kv.set(`doctor:verified:${doctorId}`, doctorId);
    }

    return c.json({ 
      doctor,
      message: `Doctor ${status} successfully` 
    });
  } catch (error) {
    console.error("Error verifying doctor:", error);
    return c.json({ error: "Failed to verify doctor" }, 500);
  }
});

// ==================== DISEASE DETECTION ====================

// Save disease detection record
app.post("/make-server-b83a1961/diseases", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const body = await c.req.json();

    // Allow guest mode for disease detection
    let userId = "guest";
    const { user: authUser } = await verifyToken(authHeader);
    if (authUser) {
      userId = authUser.id;
    }

    const record: DiseaseRecord = {
      id: `disease_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      disease: body.disease,
      disease_bn: body.disease_bn,
      confidence: body.confidence,
      image_url: body.image_url,
      advisory_en: body.advisory_en,
      advisory_bn: body.advisory_bn,
      treatment_en: body.treatment_en,
      treatment_bn: body.treatment_bn,
      prevention_en: body.prevention_en,
      prevention_bn: body.prevention_bn,
      crop: body.crop,
      crop_bn: body.crop_bn,
      detectedAt: new Date().toISOString(),
      reviewed: false,
    };

    await kv.set(`disease:${record.id}`, record);
    await kv.set(`disease:user:${userId}:${record.id}`, record.id);

    return c.json({ record, message: "Disease record saved" });
  } catch (error) {
    console.error("Error saving disease record:", error);
    return c.json({ error: "Failed to save disease record" }, 500);
  }
});

// Get user's disease history
app.get("/make-server-b83a1961/diseases", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const recordIds = await kv.getByPrefix<string>(`disease:user:${authUser.id}:`);
    const records: DiseaseRecord[] = [];

    for (const recordId of recordIds) {
      const record = await kv.get<DiseaseRecord>(`disease:${recordId}`);
      if (record) {
        records.push(record);
      }
    }

    // Sort by date, newest first
    records.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    return c.json({ records });
  } catch (error) {
    console.error("Error fetching disease records:", error);
    return c.json({ error: "Failed to fetch disease records" }, 500);
  }
});

// ==================== IRRIGATION ====================

// Get irrigation schedule
app.get("/make-server-b83a1961/irrigation/:userId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = c.req.param("userId");
    if (userId !== authUser.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const schedule = await kv.get<IrrigationSchedule>(`irrigation:${userId}`);
    
    if (!schedule) {
      return c.json({ error: "No irrigation schedule found" }, 404);
    }

    return c.json({ schedule });
  } catch (error) {
    console.error("Error fetching irrigation schedule:", error);
    return c.json({ error: "Failed to fetch irrigation schedule" }, 500);
  }
});

// Update irrigation schedule
app.put("/make-server-b83a1961/irrigation/:userId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = c.req.param("userId");
    if (userId !== authUser.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const updates = await c.req.json();
    const existingSchedule = await kv.get<IrrigationSchedule>(`irrigation:${userId}`);

    const schedule: IrrigationSchedule = {
      ...existingSchedule,
      ...updates,
      id: userId,
      userId,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`irrigation:${userId}`, schedule);

    return c.json({ schedule, message: "Irrigation schedule updated" });
  } catch (error) {
    console.error("Error updating irrigation schedule:", error);
    return c.json({ error: "Failed to update irrigation schedule" }, 500);
  }
});

// ==================== CONSULTATIONS ====================

// Create consultation
app.post("/make-server-b83a1961/consultations", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const farmer = await kv.get<User>(`user:${authUser.id}`);

    if (!farmer) {
      return c.json({ error: "User not found" }, 404);
    }

    const consultation: Consultation = {
      id: `consultation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      farmerId: authUser.id,
      farmerName: farmer.name,
      farmerEmail: farmer.email,
      crop: body.crop,
      crop_bn: body.crop_bn,
      disease: body.disease,
      disease_bn: body.disease_bn,
      description: body.description,
      description_en: body.description_en || body.description,
      location: body.location || farmer.location || "Unknown",
      location_bn: body.location_bn || farmer.location_bn || "অজানা",
      priority: body.priority || "medium",
      status: "pending",
      images: body.images || [],
      submittedAt: new Date().toISOString(),
    };

    await kv.set(`consultation:${consultation.id}`, consultation);
    await kv.set(`consultation:farmer:${authUser.id}:${consultation.id}`, consultation.id);
    await kv.set(`consultation:pending:${consultation.id}`, consultation.id);

    return c.json({ consultation, message: "Consultation created" });
  } catch (error) {
    console.error("Error creating consultation:", error);
    return c.json({ error: "Failed to create consultation" }, 500);
  }
});

// Get consultations (filtered by role)
app.get("/make-server-b83a1961/consultations", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (!currentUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const consultations: Consultation[] = [];

    if (currentUser.role === "farmer") {
      // Get farmer's own consultations
      const consultationIds = await kv.getByPrefix<string>(`consultation:farmer:${authUser.id}:`);
      for (const consultationId of consultationIds) {
        const consultation = await kv.get<Consultation>(`consultation:${consultationId}`);
        if (consultation) {
          consultations.push(consultation);
        }
      }
    } else if (currentUser.role === "doctor") {
      // Get all pending and assigned consultations
      const allConsultations = await kv.getByPrefix<Consultation>("consultation:");
      consultations.push(...allConsultations.filter(c => 
        c && c.id && !c.id.includes(":") && 
        (c.status === "pending" || c.doctorId === authUser.id)
      ));
    } else if (currentUser.role === "admin") {
      // Get all consultations
      const allConsultations = await kv.getByPrefix<Consultation>("consultation:");
      consultations.push(...allConsultations.filter(c => c && c.id && !c.id.includes(":")));
    }

    // Sort by date, newest first
    consultations.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return c.json({ consultations });
  } catch (error) {
    console.error("Error fetching consultations:", error);
    return c.json({ error: "Failed to fetch consultations" }, 500);
  }
});

// Update consultation (respond as doctor)
app.put("/make-server-b83a1961/consultations/:consultationId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (!currentUser || currentUser.role !== "doctor") {
      return c.json({ error: "Doctor access required" }, 403);
    }

    const consultationId = c.req.param("consultationId");
    const updates = await c.req.json();

    const consultation = await kv.get<Consultation>(`consultation:${consultationId}`);
    if (!consultation) {
      return c.json({ error: "Consultation not found" }, 404);
    }

    const updatedConsultation: Consultation = {
      ...consultation,
      ...updates,
      doctorId: authUser.id,
      doctorName: currentUser.name,
      status: updates.status || "in-progress",
    };

    await kv.set(`consultation:${consultationId}`, updatedConsultation);

    // Remove from pending if status changed
    if (updates.status !== "pending") {
      await kv.del(`consultation:pending:${consultationId}`);
    }

    return c.json({ consultation: updatedConsultation, message: "Consultation updated" });
  } catch (error) {
    console.error("Error updating consultation:", error);
    return c.json({ error: "Failed to update consultation" }, 500);
  }
});

// ==================== MARKET PRICES ====================

// Get market prices
app.get("/make-server-b83a1961/prices", async (c) => {
  try {
    const location = c.req.query("location");
    const crop = c.req.query("crop");

    let prices = await kv.getByPrefix<MarketPrice>("price:");
    prices = prices.filter(p => p && p.id && !p.id.includes(":"));

    if (location) {
      prices = prices.filter(p => p.location === location);
    }

    if (crop) {
      prices = prices.filter(p => p.crop === crop);
    }

    return c.json({ prices });
  } catch (error) {
    console.error("Error fetching prices:", error);
    return c.json({ error: "Failed to fetch prices" }, 500);
  }
});

// Update market price (admin only)
app.post("/make-server-b83a1961/prices", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const currentUser = await kv.get<User>(`user:${authUser.id}`);
    if (!currentUser || currentUser.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    const body = await c.req.json();
    const price: MarketPrice = {
      id: `price_${body.crop}_${body.location}_${Date.now()}`,
      ...body,
      lastUpdated: new Date().toLocaleString('en-US'),
      lastUpdated_bn: new Date().toLocaleString('bn-BD'),
    };

    await kv.set(`price:${price.id}`, price);

    return c.json({ price, message: "Price updated" });
  } catch (error) {
    console.error("Error updating price:", error);
    return c.json({ error: "Failed to update price" }, 500);
  }
});

// ==================== PRICE ALERTS ====================

// Create price alert
app.post("/make-server-b83a1961/alerts", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const alert: PriceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: authUser.id,
      crop: body.crop,
      crop_bn: body.crop_bn,
      targetPrice: body.targetPrice,
      condition: body.condition,
      location: body.location,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`alert:${alert.id}`, alert);
    await kv.set(`alert:user:${authUser.id}:${alert.id}`, alert.id);

    return c.json({ alert, message: "Alert created" });
  } catch (error) {
    console.error("Error creating alert:", error);
    return c.json({ error: "Failed to create alert" }, 500);
  }
});

// Get user's alerts
app.get("/make-server-b83a1961/alerts", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const alertIds = await kv.getByPrefix<string>(`alert:user:${authUser.id}:`);
    const alerts: PriceAlert[] = [];

    for (const alertId of alertIds) {
      const alert = await kv.get<PriceAlert>(`alert:${alertId}`);
      if (alert) {
        alerts.push(alert);
      }
    }

    return c.json({ alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return c.json({ error: "Failed to fetch alerts" }, 500);
  }
});

// Delete alert
app.delete("/make-server-b83a1961/alerts/:alertId", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const alertId = c.req.param("alertId");
    const alert = await kv.get<PriceAlert>(`alert:${alertId}`);

    if (!alert) {
      return c.json({ error: "Alert not found" }, 404);
    }

    if (alert.userId !== authUser.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await kv.del(`alert:${alertId}`);
    await kv.del(`alert:user:${authUser.id}:${alertId}`);

    return c.json({ message: "Alert deleted" });
  } catch (error) {
    console.error("Error deleting alert:", error);
    return c.json({ error: "Failed to delete alert" }, 500);
  }
});

// ==================== DEVICES ====================

// Register device
app.post("/make-server-b83a1961/devices", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const device: Device = {
      id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: authUser.id,
      type: body.type,
      type_bn: body.type_bn,
      status: "active",
      status_bn: "সক্রিয়",
      lastSync: new Date().toISOString(),
    };

    await kv.set(`device:${device.id}`, device);
    await kv.set(`device:user:${authUser.id}:${device.id}`, device.id);

    return c.json({ device, message: "Device registered" });
  } catch (error) {
    console.error("Error registering device:", error);
    return c.json({ error: "Failed to register device" }, 500);
  }
});

// Get user's devices
app.get("/make-server-b83a1961/devices", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const { user: authUser, error } = await verifyToken(authHeader);

    if (error || !authUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const deviceIds = await kv.getByPrefix<string>(`device:user:${authUser.id}:`);
    const devices: Device[] = [];

    for (const deviceId of deviceIds) {
      const device = await kv.get<Device>(`device:${deviceId}`);
      if (device) {
        devices.push(device);
      }
    }

    return c.json({ devices });
  } catch (error) {
    console.error("Error fetching devices:", error);
    return c.json({ error: "Failed to fetch devices" }, 500);
  }
});

Deno.serve(app.fetch);