/**
 * Command History System
 * Manages operation stack for undo/redo functionality with project integration
 */

class Command {
  constructor(type, data, timestamp = Date.now()) {
    this.id = `cmd_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.data = data;
    this.timestamp = timestamp;
    this.executed = false;
    this.undone = false;
  }

  // Execute the command
  async execute() {
    if (this.executed && !this.undone) {
      console.warn(`Command ${this.id} is already executed`);
      return;
    }

    try {
      await this.doExecute();
      this.executed = true;
      this.undone = false;
      return true;
    } catch (error) {
      console.error(`Failed to execute command ${this.id}:`, error);
      throw error;
    }
  }

  // Undo the command
  async undo() {
    if (!this.executed || this.undone) {
      console.warn(`Command ${this.id} cannot be undone (executed: ${this.executed}, undone: ${this.undone})`);
      return;
    }

    try {
      await this.doUndo();
      this.undone = true;
      return true;
    } catch (error) {
      console.error(`Failed to undo command ${this.id}:`, error);
      throw error;
    }
  }

  // Redo the command (same as execute for undone commands)
  async redo() {
    if (!this.undone) {
      console.warn(`Command ${this.id} is not undone, cannot redo`);
      return;
    }

    try {
      await this.doExecute();
      this.undone = false;
      return true;
    } catch (error) {
      console.error(`Failed to redo command ${this.id}:`, error);
      throw error;
    }
  }

  // Abstract methods to be implemented by subclasses
  async doExecute() {
    throw new Error('doExecute must be implemented by subclass');
  }

  async doUndo() {
    throw new Error('doUndo must be implemented by subclass');
  }

  // Get command description for UI
  getDescription() {
    return `${this.type} operation`;
  }

  // Get command metadata
  getMetadata() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      executed: this.executed,
      undone: this.undone,
      description: this.getDescription()
    };
  }

  // Serialize command for save/load
  serialize() {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
      executed: this.executed,
      undone: this.undone
    };
  }

  // Deserialize command from saved data
  static deserialize(serialized) {
    const command = new Command(serialized.type, serialized.data, serialized.timestamp);
    command.id = serialized.id;
    command.executed = serialized.executed;
    command.undone = serialized.undone;
    return command;
  }
}

class CommandHistory {
  constructor(options = {}) {
    this.commands = [];
    this.currentIndex = -1;
    this.maxHistorySize = options.maxHistorySize || 100;
    this.enableGrouping = options.enableGrouping !== false;
    this.groupTimeout = options.groupTimeout || 1000; // 1 second
    this.lastCommandTime = 0;
    this.currentGroup = null;
    this.eventListeners = new Map();
    this.isExecuting = false;
    this.saveVersion = 0; // Track save state for dirty checking
    this.lastSaveIndex = -1;
  }

  // Event system
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Execute and record a command
  async executeCommand(command) {
    if (this.isExecuting) {
      console.warn('Command execution already in progress');
      return false;
    }

    this.isExecuting = true;

    try {
      // Execute the command
      await command.execute();

      // Handle command grouping
      const now = Date.now();
      const shouldGroup = this.enableGrouping && 
                         this.currentGroup && 
                         (now - this.lastCommandTime) < this.groupTimeout &&
                         this.canGroupWith(command, this.currentGroup);

      if (shouldGroup) {
        // Add to current group
        this.currentGroup.addCommand(command);
      } else {
        // Start new command/group
        this.addToHistory(command);
      }

      this.lastCommandTime = now;
      this.emit('commandExecuted', { command, canUndo: this.canUndo(), canRedo: this.canRedo() });

      return true;
    } catch (error) {
      console.error('Failed to execute command:', error);
      this.emit('commandError', { command, error });
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  // Add command to history
  addToHistory(command) {
    // Remove any commands after current index (when adding new command after undo)
    if (this.currentIndex < this.commands.length - 1) {
      this.commands.splice(this.currentIndex + 1);
    }

    // Add the new command
    this.commands.push(command);
    this.currentIndex = this.commands.length - 1;

    // Maintain history size limit
    if (this.commands.length > this.maxHistorySize) {
      const removed = this.commands.shift();
      this.currentIndex--;
      if (this.lastSaveIndex >= 0) {
        this.lastSaveIndex--;
      }
      this.emit('commandRemoved', { command: removed });
    }

    // Update current group
    if (this.enableGrouping && !(command instanceof CommandGroup)) {
      this.currentGroup = new CommandGroup([command]);
      this.commands[this.currentIndex] = this.currentGroup;
    } else {
      this.currentGroup = command instanceof CommandGroup ? command : null;
    }
  }

  // Check if command can be grouped with another
  canGroupWith(command, group) {
    if (!group || !(group instanceof CommandGroup)) return false;

    // Group similar operations (e.g., multiple moves, multiple typing)
    const lastCommand = group.getLastCommand();
    if (!lastCommand) return false;

    return (
      command.type === lastCommand.type &&
      this.areCommandsGroupable(command, lastCommand)
    );
  }

  // Check if two commands can be grouped
  areCommandsGroupable(cmd1, cmd2) {
    // Entity operations on the same entity can be grouped
    if (cmd1.data?.entityId && cmd2.data?.entityId) {
      return cmd1.data.entityId === cmd2.data.entityId;
    }

    // Text editing operations can be grouped
    if (cmd1.type === 'text' && cmd2.type === 'text') {
      return true;
    }

    // Transform operations can be grouped
    if (['move', 'rotate', 'scale'].includes(cmd1.type) && cmd1.type === cmd2.type) {
      return true;
    }

    return false;
  }

  // Undo the last command
  async undo() {
    if (!this.canUndo()) {
      console.warn('Cannot undo: no commands available');
      return false;
    }

    if (this.isExecuting) {
      console.warn('Cannot undo: command execution in progress');
      return false;
    }

    this.isExecuting = true;

    try {
      const command = this.commands[this.currentIndex];
      await command.undo();
      
      this.currentIndex--;
      this.currentGroup = null; // Reset grouping after undo
      
      this.emit('commandUndone', { 
        command, 
        canUndo: this.canUndo(), 
        canRedo: this.canRedo(),
        isDirty: this.isDirty()
      });

      return true;
    } catch (error) {
      console.error('Failed to undo command:', error);
      this.emit('undoError', { error });
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  // Redo the next command
  async redo() {
    if (!this.canRedo()) {
      console.warn('Cannot redo: no commands available');
      return false;
    }

    if (this.isExecuting) {
      console.warn('Cannot redo: command execution in progress');
      return false;
    }

    this.isExecuting = true;

    try {
      this.currentIndex++;
      const command = this.commands[this.currentIndex];
      await command.redo();
      
      this.emit('commandRedone', { 
        command, 
        canUndo: this.canUndo(), 
        canRedo: this.canRedo(),
        isDirty: this.isDirty()
      });

      return true;
    } catch (error) {
      console.error('Failed to redo command:', error);
      this.currentIndex--; // Revert index on failure
      this.emit('redoError', { error });
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  // Check if undo is possible
  canUndo() {
    return this.currentIndex >= 0 && !this.isExecuting;
  }

  // Check if redo is possible
  canRedo() {
    return this.currentIndex < this.commands.length - 1 && !this.isExecuting;
  }

  // Check if there are unsaved changes
  isDirty() {
    return this.currentIndex !== this.lastSaveIndex;
  }

  // Mark current state as saved
  markAsSaved() {
    this.lastSaveIndex = this.currentIndex;
    this.saveVersion++;
    this.emit('saveStateChanged', { isDirty: false, saveVersion: this.saveVersion });
  }

  // Get current command info for UI
  getCurrentCommandInfo() {
    const command = this.currentIndex >= 0 ? this.commands[this.currentIndex] : null;
    
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      isDirty: this.isDirty(),
      undoDescription: command ? `Undo ${command.getDescription()}` : null,
      redoDescription: this.canRedo() ? 
        `Redo ${this.commands[this.currentIndex + 1].getDescription()}` : null,
      historySize: this.commands.length,
      currentIndex: this.currentIndex,
      saveVersion: this.saveVersion
    };
  }

  // Get command history for debugging/UI
  getHistory() {
    return this.commands.map((command, index) => ({
      ...command.getMetadata(),
      isCurrent: index === this.currentIndex,
      isActive: index <= this.currentIndex
    }));
  }

  // Clear all history
  clear() {
    this.commands = [];
    this.currentIndex = -1;
    this.currentGroup = null;
    this.lastSaveIndex = -1;
    this.saveVersion = 0;
    this.emit('historyCleared', {});
  }

  // Serialize history for save/load
  serialize() {
    return {
      commands: this.commands.map(cmd => cmd.serialize()),
      currentIndex: this.currentIndex,
      lastSaveIndex: this.lastSaveIndex,
      saveVersion: this.saveVersion,
      timestamp: Date.now()
    };
  }

  // Deserialize history from saved data
  deserialize(data) {
    this.clear();
    
    this.commands = data.commands.map(cmdData => {
      // Use command factory to recreate specific command types
      return this.createCommandFromSerialized(cmdData);
    });
    
    this.currentIndex = data.currentIndex;
    this.lastSaveIndex = data.lastSaveIndex;
    this.saveVersion = data.saveVersion || 0;
    
    this.emit('historyLoaded', { 
      commandCount: this.commands.length,
      isDirty: this.isDirty()
    });
  }

  // Factory method to create commands from serialized data
  createCommandFromSerialized(data) {
    // This will be extended by command registry
    return Command.deserialize(data);
  }

  // Cleanup
  cleanup() {
    this.eventListeners.clear();
    this.clear();
  }
}

// Command group for batching operations
class CommandGroup extends Command {
  constructor(commands = []) {
    super('group', { commands }, Date.now());
    this.commands = commands;
  }

  async doExecute() {
    for (const command of this.commands) {
      await command.execute();
    }
  }

  async doUndo() {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }

  addCommand(command) {
    this.commands.push(command);
  }

  getLastCommand() {
    return this.commands[this.commands.length - 1];
  }

  getDescription() {
    if (this.commands.length === 1) {
      return this.commands[0].getDescription();
    }
    return `${this.commands.length} operations`;
  }

  serialize() {
    return {
      ...super.serialize(),
      commands: this.commands.map(cmd => cmd.serialize())
    };
  }

  static deserialize(data) {
    const group = new CommandGroup();
    group.id = data.id;
    group.type = data.type;
    group.timestamp = data.timestamp;
    group.executed = data.executed;
    group.undone = data.undone;
    group.commands = data.commands.map(cmdData => Command.deserialize(cmdData));
    return group;
  }
}

// Export singleton instance
const commandHistory = new CommandHistory({
  maxHistorySize: 100,
  enableGrouping: true,
  groupTimeout: 1000
});

export default commandHistory;
export { Command, CommandHistory, CommandGroup }; 