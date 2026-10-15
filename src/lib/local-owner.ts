import "server-only";
import { DEFAULT_CATEGORIES, DEFAULT_HABITS, mergePreferences } from "./domain/defaults";
import { DEFAULT_TIMEZONE, todayISO } from "./domain/dates";
import { openStore, type ProfileRecord, type UserRecord } from "./db/sqlite";

export const LOCAL_OWNER_EMAIL = "owner@peace.local";

export function ensureLocalOwner(): { user: UserRecord; profile: ProfileRecord } {
  const store = openStore();
  let user = store.findUserByEmail(LOCAL_OWNER_EMAIL);
  if (!user) {
    user = store.createUser({
      email: LOCAL_OWNER_EMAIL,
      password: "local-only-no-login",
      displayName: "",
      timezone: DEFAULT_TIMEZONE,
      preferences: mergePreferences({ onboardingComplete: true }),
    });
  }

  const categories = store.listCategories(user.id, true);
  if (categories.length === 0) {
    const categoryIds = new Map<string, string>();
    for (const category of DEFAULT_CATEGORIES) {
      const created = store.createCategory(user.id, category);
      categoryIds.set(category.key, created.id);
    }
    const profile = store.getProfile(user.id);
    const today = todayISO(profile?.timezone ?? DEFAULT_TIMEZONE);
    for (const habit of DEFAULT_HABITS) {
      if (!habit.enabledByDefault) continue;
      store.createHabit(user.id, {
        title: habit.title,
        description: habit.description ?? null,
        categoryId: categoryIds.get(habit.categoryKey) ?? null,
        recurrenceType: "daily",
        recurrenceConfig: {},
        targetQuantity: null,
        targetUnit: null,
        startDate: today,
        endDate: null,
        reminderEnabled: false,
        reminderTime: null,
      });
    }
  }

  const profile = store.getProfile(user.id);
  if (profile && !profile.preferences.onboardingComplete) {
    store.updateProfile(user.id, {
      preferences: mergePreferences({ ...profile.preferences, onboardingComplete: true }),
    });
  }

  return { user: store.findUserById(user.id)!, profile: store.getProfile(user.id)! };
}
