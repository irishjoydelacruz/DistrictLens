import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = [
  "super_admin",
  "customer_service",
  "field_worker",
] as const;

type UserRole = (typeof ALLOWED_ROLES)[number];

async function verifySuperAdmin() {
  // User management belongs to the admin portal.
  const supabase = await createClient("admin");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      ),
    };
  }

  const adminSupabase = createAdminClient();

  const { data: profile, error } = await adminSupabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("VERIFY ADMIN ERROR:", error.message);

    return {
      response: NextResponse.json(
        { error: "Unable to verify administrator permissions." },
        { status: 500 }
      ),
    };
  }

  if (!profile || profile.role !== "super_admin") {
    return {
      response: NextResponse.json(
        { error: "Only Super Admin can manage user accounts." },
        { status: 403 }
      ),
    };
  }

  return { user, adminSupabase };
}

function isValidRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && ALLOWED_ROLES.includes(value as UserRole)
  );
}

function readEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function readTeamId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

// GET: Read all accounts + the list of teams
export async function GET() {
  try {
    const access = await verifySuperAdmin();

    if ("response" in access) return access.response;

    const { adminSupabase } = access;

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select(
        "id, full_name, email, role, status, team_id, must_change_password"
      )
      .order("full_name", { ascending: true });

    if (profilesError) {
      console.error("GET PROFILES ERROR:", profilesError.message);

      return NextResponse.json(
        { error: "Unable to load user profiles." },
        { status: 500 }
      );
    }

    // Users who asked for a password reset (table may not exist yet).
    const { data: requests, error: requestsError } = await adminSupabase
      .from("password_reset_requests")
      .select("user_id")
      .eq("status", "pending");

    if (requestsError) {
      console.error("GET RESET REQUESTS ERROR:", requestsError.message);
    }

    const requestedIds = new Set(
      (requests ?? []).map((item) => item.user_id as string)
    );

    const { data: teams, error: teamsError } = await adminSupabase
      .from("teams")
      .select("id, name")
      .order("name", { ascending: true });

    if (teamsError) {
      console.error("GET TEAMS ERROR:", teamsError.message);
    }

    const users = (profiles ?? []).map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email ?? null,
      role: profile.role,
      status: profile.status,
      teamId: profile.team_id ?? null,
      mustChangePassword: profile.must_change_password,
      resetRequested: requestedIds.has(profile.id),
    }));

    return NextResponse.json({ users, teams: teams ?? [] });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while loading users." },
      { status: 500 }
    );
  }
}

// POST: Create account (pre-approved, with a temporary password)
export async function POST(request: Request) {
  try {
    const access = await verifySuperAdmin();

    if ("response" in access) return access.response;

    const { adminSupabase } = access;
    const body = await request.json();

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";

    const role = body.role;
    const teamId = readTeamId(body.teamId);

    const email = readEmail(body.email);

    if (!fullName || !isValidRole(role)) {
      return NextResponse.json(
        { error: "Enter a valid name and role." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (role === "field_worker" && !teamId) {
      return NextResponse.json(
        { error: "Select a team for field accounts." },
        { status: 400 }
      );
    }

    // Reject an email that is already used by another account.
    const { data: emailTaken, error: existingError } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "Unable to check existing accounts." },
        { status: 500 }
      );
    }

    if (emailTaken) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const temporaryPassword = randomBytes(24).toString("base64url");

    const { data, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError || !data.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Unable to create account." },
        { status: 400 }
      );
    }

    const newUserId = data.user.id;

    // upsert: the new-signup trigger may already have created a row.
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          full_name: fullName,
          email,
          role,
          status: "approved", // accounts created by the admin are pre-approved
          team_id: role === "field_worker" ? teamId : null,
          must_change_password: true,
          provider: "password",
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("PROFILE CREATION ERROR:", profileError.message);

      const { error: cleanupError } =
        await adminSupabase.auth.admin.deleteUser(newUserId);

      if (cleanupError) {
        console.error("AUTH CLEANUP ERROR:", cleanupError.message);
      }

      return NextResponse.json(
        { error: "Could not create the user's profile." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Account created successfully.",
        user: {
          id: newUserId,
          fullName,
          email,
          role,
        },
        temporaryPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while creating the account." },
      { status: 500 }
    );
  }
}

// PATCH: reset password, approve / reject, or update name, role and team
export async function PATCH(request: Request) {
  try {
    const access = await verifySuperAdmin();

    if ("response" in access) return access.response;

    const { user: currentUser, adminSupabase } = access;
    const body = await request.json();

    // ---------- Reset a user's password ----------
    if (body.action === "reset-password") {
      const targetId = typeof body.id === "string" ? body.id : "";

      if (!targetId) {
        return NextResponse.json(
          { error: "User ID is required." },
          { status: 400 }
        );
      }

      if (targetId === currentUser.id) {
        return NextResponse.json(
          { error: "Use Change Password to update your own password." },
          { status: 400 }
        );
      }

      const { data: resetTarget, error: resetTargetError } =
        await adminSupabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", targetId)
          .maybeSingle();

      if (resetTargetError || !resetTarget) {
        return NextResponse.json(
          { error: "User account not found." },
          { status: 404 }
        );
      }

      const temporaryPassword = randomBytes(24).toString("base64url");

      const { error: passwordError } =
        await adminSupabase.auth.admin.updateUserById(targetId, {
          password: temporaryPassword,
        });

      if (passwordError) {
        console.error("RESET PASSWORD ERROR:", passwordError.message);

        return NextResponse.json(
          { error: "Unable to reset the password." },
          { status: 500 }
        );
      }

      const { error: flagError } = await adminSupabase
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", targetId);

      if (flagError) {
        console.error("RESET FLAG ERROR:", flagError.message);
      }

      // Close any pending request from this user.
      const { error: closeError } = await adminSupabase
        .from("password_reset_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("user_id", targetId)
        .eq("status", "pending");

      if (closeError) {
        console.error("CLOSE RESET REQUEST ERROR:", closeError.message);
      }

      return NextResponse.json({
        message: "Password reset successfully.",
        fullName: resetTarget.full_name,
        temporaryPassword,
      });
    }

    // ---------- Approve or reject a pending account ----------
    if (body.action === "approve" || body.action === "reject") {
      const targetId = typeof body.id === "string" ? body.id : "";

      if (!targetId) {
        return NextResponse.json(
          { error: "User ID is required." },
          { status: 400 }
        );
      }

      if (targetId === currentUser.id) {
        return NextResponse.json(
          { error: "You cannot change your own account status." },
          { status: 400 }
        );
      }

      if (body.action === "reject") {
        const { error: rejectError } = await adminSupabase
          .from("profiles")
          .update({ status: "rejected" })
          .eq("id", targetId);

        if (rejectError) {
          console.error("REJECT ERROR:", rejectError.message);

          return NextResponse.json(
            { error: "Unable to reject the account." },
            { status: 500 }
          );
        }

        return NextResponse.json({ message: "Account rejected." });
      }

      const approveRole = body.role;
      const approveTeamId = readTeamId(body.teamId);

      if (!isValidRole(approveRole)) {
        return NextResponse.json(
          { error: "Choose a valid role." },
          { status: 400 }
        );
      }

      if (approveRole === "field_worker") {
        if (!approveTeamId) {
          return NextResponse.json(
            { error: "Select a team for field accounts." },
            { status: 400 }
          );
        }

        const { data: teamRow } = await adminSupabase
          .from("teams")
          .select("id")
          .eq("id", approveTeamId)
          .maybeSingle();

        if (!teamRow) {
          return NextResponse.json(
            { error: "Selected team was not found." },
            { status: 400 }
          );
        }
      }

      const { error: approveError } = await adminSupabase
        .from("profiles")
        .update({
          status: "approved",
          role: approveRole,
          team_id: approveRole === "field_worker" ? approveTeamId : null,
        })
        .eq("id", targetId);

      if (approveError) {
        console.error("APPROVE ERROR:", approveError.message);

        return NextResponse.json(
          { error: "Unable to approve the account." },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: "Account approved." });
    }

    // ---------- Update name, email, role and team ----------
    const id = typeof body.id === "string" ? body.id : "";
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const role = body.role;
    const teamId = readTeamId(body.teamId);
    const newEmail = readEmail(body.email);

    if (!id || !fullName || !isValidRole(role)) {
      return NextResponse.json(
        { error: "User ID, full name, and valid role are required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(newEmail)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (role === "field_worker" && !teamId) {
      return NextResponse.json(
        { error: "Select a team for field accounts." },
        { status: 400 }
      );
    }

    // Prevent changing your own administrator role.
    if (id === currentUser.id && role !== "super_admin") {
      return NextResponse.json(
        { error: "You cannot remove your own Super Admin role." },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await adminSupabase
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json(
        { error: "Unable to find the selected account." },
        { status: 500 }
      );
    }

    if (!target) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // Do not allow demoting the last Super Admin.
    if (target.role === "super_admin" && role !== "super_admin") {
      const { count, error: countError } = await adminSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin");

      if (countError) {
        return NextResponse.json(
          { error: "Unable to verify Super Admin accounts." },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "You cannot remove the last Super Admin." },
          { status: 400 }
        );
      }
    }

    const { data: currentAuth, error: currentAuthError } =
      await adminSupabase.auth.admin.getUserById(id);

    if (currentAuthError || !currentAuth.user) {
      return NextResponse.json(
        { error: "Unable to find the login account." },
        { status: 500 }
      );
    }

    const previousEmail = (currentAuth.user.email ?? "").toLowerCase();
    const emailChanged = previousEmail !== newEmail;

    if (emailChanged) {
      // The email must not belong to another account.
      const { data: emailTaken, error: emailCheckError } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("email", newEmail)
        .neq("id", id)
        .maybeSingle();

      if (emailCheckError) {
        return NextResponse.json(
          { error: "Unable to check existing accounts." },
          { status: 500 }
        );
      }

      if (emailTaken) {
        return NextResponse.json(
          { error: "Another account already uses this email." },
          { status: 409 }
        );
      }

      // Changes the login email. The password stays the same.
      const { error: emailError } =
        await adminSupabase.auth.admin.updateUserById(id, {
          email: newEmail,
          email_confirm: true,
        });

      if (emailError) {
        console.error("UPDATE AUTH EMAIL ERROR:", emailError.message);

        const alreadyUsed = /already|registered|exists/i.test(
          emailError.message
        );

        return NextResponse.json(
          {
            error: alreadyUsed
              ? "Another account already uses this email."
              : "Unable to update the login email.",
          },
          { status: alreadyUsed ? 409 : 500 }
        );
      }
    }

    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({
        full_name: fullName,
        email: newEmail,
        role,
        team_id: role === "field_worker" ? teamId : null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("UPDATE PROFILE ERROR:", updateError.message);

      // Roll the login email back so profile and login stay matched.
      if (emailChanged && previousEmail) {
        await adminSupabase.auth.admin.updateUserById(id, {
          email: previousEmail,
          email_confirm: true,
        });
      }

      return NextResponse.json(
        { error: "Unable to update the user profile." },
        { status: 500 }
      );
    }

    const { error: metadataError } =
      await adminSupabase.auth.admin.updateUserById(id, {
        user_metadata: { full_name: fullName },
      });

    if (metadataError) {
      console.error("UPDATE AUTH METADATA ERROR:", metadataError.message);
    }

    return NextResponse.json({
      message: "User account updated successfully.",
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while updating the account." },
      { status: 500 }
    );
  }
}

// DELETE: Delete account
export async function DELETE(request: Request) {
  try {
    const access = await verifySuperAdmin();

    if ("response" in access) return access.response;

    const { user: currentUser, adminSupabase } = access;
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    if (id === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account here." },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await adminSupabase
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json(
        { error: "Unable to find the selected account." },
        { status: 500 }
      );
    }

    if (!target) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // Protect the last Super Admin.
    if (target.role === "super_admin") {
      const { count, error: countError } = await adminSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin");

      if (countError) {
        return NextResponse.json(
          { error: "Unable to verify Super Admin accounts." },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "You cannot delete the last Super Admin." },
          { status: 400 }
        );
      }
    }

    // Delete the Auth user first. If profiles has a foreign key to
    // auth.users, Supabase may remove the profile automatically.
    const { error: deleteAuthError } =
      await adminSupabase.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      console.error("DELETE AUTH USER ERROR:", deleteAuthError.message);

      return NextResponse.json(
        { error: "Unable to delete the authentication account." },
        { status: 500 }
      );
    }

    // Clean up a profile if it was not removed by a foreign-key cascade.
    const { error: deleteProfileError } = await adminSupabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (deleteProfileError) {
      console.error(
        "DELETE PROFILE CLEANUP ERROR:",
        deleteProfileError.message
      );

      return NextResponse.json(
        {
          error:
            "The login account was deleted, but profile cleanup failed. Please check the profiles table.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "User account deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong while deleting the account." },
      { status: 500 }
    );
  }
}