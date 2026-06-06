import type { Command, CommandCategory } from "./types";

/**
 * Central registry of globally-dispatchable commands (Command pattern). Fails
 * fast on duplicate ids or colliding bindings so conflicts surface during
 * development rather than as silently-shadowed shortcuts at runtime.
 *
 * A module singleton {@link shortcutRegistry} backs the app; tests construct
 * their own instances.
 */
export class ShortcutRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Duplicate shortcut command id: "${command.id}"`);
    }
    const conflict = this.findByKeys(command.defaultKeys);
    if (conflict) {
      throw new Error(
        `Binding conflict: "${command.defaultKeys}" is bound to both ` +
          `"${conflict.id}" and "${command.id}"`,
      );
    }
    this.commands.set(command.id, command);
  }

  registerAll(commands: readonly Command[]): void {
    for (const command of commands) this.register(command);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  clear(): void {
    this.commands.clear();
  }

  get size(): number {
    return this.commands.size;
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  private findByKeys(keys: string): Command | undefined {
    const normalized = keys.trim().toLowerCase();
    return this.all().find(
      (c) => c.defaultKeys.trim().toLowerCase() === normalized,
    );
  }

  /** Commands grouped by category, preserving insertion order within a group. */
  byCategory(): Record<CommandCategory, Command[]> {
    const groups: Record<CommandCategory, Command[]> = {
      navigation: [],
      create: [],
      view: [],
      general: [],
    };
    for (const command of this.commands.values()) {
      groups[command.category].push(command);
    }
    return groups;
  }
}

export const shortcutRegistry = new ShortcutRegistry();
