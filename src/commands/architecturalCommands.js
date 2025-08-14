/**
 * Architectural Commands
 * Specific command implementations for CAD operations like walls, doors, windows, etc.
 */

import { Command } from '../utils/commandHistory.js';

// Base class for entity commands
class EntityCommand extends Command {
  constructor(type, entityData, sceneManager) {
    super(type, entityData);
    this.sceneManager = sceneManager;
    this.entityId = entityData.id || `${type}_${Date.now()}`;
    this.entityData = { ...entityData, id: this.entityId };
    this.previousState = null;
  }

  async doExecute() {
    try {
      // Store previous state for undo
      if (this.sceneManager.hasEntity && this.sceneManager.hasEntity(this.entityId)) {
        this.previousState = this.sceneManager.getEntity(this.entityId);
      }

      // Execute the entity operation
      await this.executeEntityOperation();

      // Update UI if needed
      this.updateUI();

      return true;
    } catch (error) {
      console.error(`Failed to execute ${this.type} command:`, error);
      throw error;
    }
  }

  async doUndo() {
    try {
      await this.undoEntityOperation();
      this.updateUI();
      return true;
    } catch (error) {
      console.error(`Failed to undo ${this.type} command:`, error);
      throw error;
    }
  }

  // Abstract methods to be implemented by subclasses
  async executeEntityOperation() {
    throw new Error('executeEntityOperation must be implemented');
  }

  async undoEntityOperation() {
    throw new Error('undoEntityOperation must be implemented');
  }

  updateUI() {
    // Trigger UI updates
    if (this.sceneManager.emit) {
      this.sceneManager.emit('entityChanged', {
        entityId: this.entityId,
        entityType: this.type,
        command: this
      });
    }
  }
}

// Create Wall Command
class CreateWallCommand extends EntityCommand {
  constructor(wallData, sceneManager) {
    super('createWall', wallData, sceneManager);
  }

  async executeEntityOperation() {
    // Add wall to scene
    await this.sceneManager.addWall(this.entityData);
  }

  async undoEntityOperation() {
    // Remove wall from scene
    await this.sceneManager.removeWall(this.entityId);
  }

  getDescription() {
    return `Create Wall (${this.entityData.length || 'unknown'}m)`;
  }
}

// Delete Wall Command
class DeleteWallCommand extends EntityCommand {
  constructor(wallId, sceneManager) {
    super('deleteWall', { id: wallId }, sceneManager);
  }

  async executeEntityOperation() {
    // Store wall data before deletion
    this.previousState = await this.sceneManager.getWall(this.entityId);
    
    // Remove wall from scene
    await this.sceneManager.removeWall(this.entityId);
  }

  async undoEntityOperation() {
    // Restore wall from stored data
    if (this.previousState) {
      await this.sceneManager.addWall(this.previousState);
    }
  }

  getDescription() {
    return `Delete Wall`;
  }
}

// Modify Wall Command
class ModifyWallCommand extends EntityCommand {
  constructor(wallId, newData, sceneManager) {
    super('modifyWall', { id: wallId, ...newData }, sceneManager);
  }

  async executeEntityOperation() {
    // Store original state
    this.previousState = await this.sceneManager.getWall(this.entityId);
    
    // Update wall properties
    await this.sceneManager.updateWall(this.entityId, this.entityData);
  }

  async undoEntityOperation() {
    // Restore original state
    if (this.previousState) {
      await this.sceneManager.updateWall(this.entityId, this.previousState);
    }
  }

  getDescription() {
    return `Modify Wall`;
  }
}

// Create Door Command
class CreateDoorCommand extends EntityCommand {
  constructor(doorData, sceneManager) {
    super('createDoor', doorData, sceneManager);
  }

  async executeEntityOperation() {
    await this.sceneManager.addDoor(this.entityData);
  }

  async undoEntityOperation() {
    await this.sceneManager.removeDoor(this.entityId);
  }

  getDescription() {
    return `Create Door (${this.entityData.width || 'unknown'}m wide)`;
  }
}

// Create Window Command
class CreateWindowCommand extends EntityCommand {
  constructor(windowData, sceneManager) {
    super('createWindow', windowData, sceneManager);
  }

  async executeEntityOperation() {
    await this.sceneManager.addWindow(this.entityData);
  }

  async undoEntityOperation() {
    await this.sceneManager.removeWindow(this.entityId);
  }

  getDescription() {
    return `Create Window (${this.entityData.width || 'unknown'}m wide)`;
  }
}

// Create Room/Slab Command
class CreateSlabCommand extends EntityCommand {
  constructor(slabData, sceneManager) {
    super('createSlab', slabData, sceneManager);
  }

  async executeEntityOperation() {
    await this.sceneManager.addSlab(this.entityData);
  }

  async undoEntityOperation() {
    await this.sceneManager.removeSlab(this.entityId);
  }

  getDescription() {
    return `Create Slab (${this.entityData.area || 'unknown'}m²)`;
  }
}

// Create Roof Command
class CreateRoofCommand extends EntityCommand {
  constructor(roofData, sceneManager) {
    super('createRoof', roofData, sceneManager);
  }

  async executeEntityOperation() {
    await this.sceneManager.addRoof(this.entityData);
  }

  async undoEntityOperation() {
    await this.sceneManager.removeRoof(this.entityId);
  }

  getDescription() {
    return `Create Roof (${this.entityData.slope || 'unknown'}° slope)`;
  }
}

// Create Stairs Command
class CreateStairCommand extends EntityCommand {
  constructor(stairData, sceneManager) {
    super('createStair', stairData, sceneManager);
  }

  async executeEntityOperation() {
    await this.sceneManager.addStair(this.entityData);
  }

  async undoEntityOperation() {
    await this.sceneManager.removeStair(this.entityId);
  }

  getDescription() {
    return `Create Stairs (${this.entityData.steps || 'unknown'} steps)`;
  }
}

// Transform Command (move, rotate, scale)
class TransformCommand extends EntityCommand {
  constructor(entityId, entityType, transformType, transformData, sceneManager) {
    super(`${transformType}${entityType}`, { 
      id: entityId, 
      transformType, 
      ...transformData 
    }, sceneManager);
    this.entityType = entityType;
    this.transformType = transformType;
  }

  async executeEntityOperation() {
    // Store original transform
    this.previousState = await this.sceneManager.getEntityTransform(this.entityId, this.entityType);
    
    // Apply transform
    await this.sceneManager.transformEntity(
      this.entityId, 
      this.entityType, 
      this.transformType, 
      this.entityData
    );
  }

  async undoEntityOperation() {
    // Restore original transform
    if (this.previousState) {
      await this.sceneManager.setEntityTransform(
        this.entityId, 
        this.entityType, 
        this.previousState
      );
    }
  }

  getDescription() {
    const action = this.transformType.charAt(0).toUpperCase() + this.transformType.slice(1);
    return `${action} ${this.entityType}`;
  }
}

// Group Command for selecting/grouping multiple entities
class GroupEntitiesCommand extends Command {
  constructor(entityIds, sceneManager) {
    super('groupEntities', { entityIds }, sceneManager);
    this.sceneManager = sceneManager;
    this.entityIds = entityIds;
    this.groupId = `group_${Date.now()}`;
  }

  async doExecute() {
    // Create group in scene manager
    await this.sceneManager.createGroup(this.groupId, this.entityIds);
  }

  async doUndo() {
    // Remove group
    await this.sceneManager.removeGroup(this.groupId);
  }

  getDescription() {
    return `Group ${this.entityIds.length} entities`;
  }
}

// Constraint Commands (integration with constraint system)
class CreateConstraintCommand extends Command {
  constructor(constraintData, constraintService) {
    super('createConstraint', constraintData);
    this.constraintService = constraintService;
    this.constraintId = null;
  }

  async doExecute() {
    // Create constraint using constraint service
    const constraint = await this.constraintService.createConstraint(this.data);
    this.constraintId = constraint.id;
  }

  async doUndo() {
    // Remove constraint
    if (this.constraintId) {
      await this.constraintService.deleteConstraint(this.constraintId);
    }
  }

  getDescription() {
    return `Create ${this.data.type} constraint`;
  }
}

class DeleteConstraintCommand extends Command {
  constructor(constraintId, constraintService) {
    super('deleteConstraint', { constraintId });
    this.constraintService = constraintService;
    this.constraintId = constraintId;
    this.previousConstraint = null;
  }

  async doExecute() {
    // Store constraint data before deletion
    this.previousConstraint = await this.constraintService.getConstraint(this.constraintId);
    
    // Delete constraint
    await this.constraintService.deleteConstraint(this.constraintId);
  }

  async doUndo() {
    // Restore constraint
    if (this.previousConstraint) {
      await this.constraintService.createConstraint(this.previousConstraint);
    }
  }

  getDescription() {
    return `Delete ${this.previousConstraint?.type || 'constraint'}`;
  }
}

// Batch Command for multiple operations
class BatchCommand extends Command {
  constructor(commands) {
    super('batch', { commands });
    this.commands = commands;
  }

  async doExecute() {
    // Execute all commands
    for (const command of this.commands) {
      await command.execute();
    }
  }

  async doUndo() {
    // Undo all commands in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }

  getDescription() {
    if (this.commands.length === 1) {
      return this.commands[0].getDescription();
    }
    return `${this.commands.length} operations`;
  }
}

// Project Save Command
class SaveProjectCommand extends Command {
  constructor(projectData, projectManager) {
    super('saveProject', projectData);
    this.projectManager = projectManager;
  }

  async doExecute() {
    // Save project
    await this.projectManager.saveProject(this.data);
    
    // Mark history as saved
    if (this.projectManager.commandHistory) {
      this.projectManager.commandHistory.markAsSaved();
    }
  }

  async doUndo() {
    // Cannot undo save operation
    console.warn('Save operation cannot be undone');
  }

  getDescription() {
    return `Save Project`;
  }
}

// Export command factory
export const CommandFactory = {
  // Entity creation commands
  createWall: (data, sceneManager) => new CreateWallCommand(data, sceneManager),
  createDoor: (data, sceneManager) => new CreateDoorCommand(data, sceneManager),
  createWindow: (data, sceneManager) => new CreateWindowCommand(data, sceneManager),
  createSlab: (data, sceneManager) => new CreateSlabCommand(data, sceneManager),
  createRoof: (data, sceneManager) => new CreateRoofCommand(data, sceneManager),
  createStair: (data, sceneManager) => new CreateStairCommand(data, sceneManager),

  // Entity modification commands
  deleteWall: (wallId, sceneManager) => new DeleteWallCommand(wallId, sceneManager),
  modifyWall: (wallId, data, sceneManager) => new ModifyWallCommand(wallId, data, sceneManager),

  // Transform commands
  moveEntity: (entityId, entityType, moveData, sceneManager) => 
    new TransformCommand(entityId, entityType, 'move', moveData, sceneManager),
  rotateEntity: (entityId, entityType, rotateData, sceneManager) => 
    new TransformCommand(entityId, entityType, 'rotate', rotateData, sceneManager),
  scaleEntity: (entityId, entityType, scaleData, sceneManager) => 
    new TransformCommand(entityId, entityType, 'scale', scaleData, sceneManager),

  // Group commands
  groupEntities: (entityIds, sceneManager) => new GroupEntitiesCommand(entityIds, sceneManager),

  // Constraint commands
  createConstraint: (data, constraintService) => new CreateConstraintCommand(data, constraintService),
  deleteConstraint: (constraintId, constraintService) => new DeleteConstraintCommand(constraintId, constraintService),

  // Batch commands
  batch: (commands) => new BatchCommand(commands),

  // Project commands
  saveProject: (data, projectManager) => new SaveProjectCommand(data, projectManager)
};

// Export individual command classes
export {
  EntityCommand,
  CreateWallCommand,
  DeleteWallCommand,
  ModifyWallCommand,
  CreateDoorCommand,
  CreateWindowCommand,
  CreateSlabCommand,
  CreateRoofCommand,
  CreateStairCommand,
  TransformCommand,
  GroupEntitiesCommand,
  CreateConstraintCommand,
  DeleteConstraintCommand,
  BatchCommand,
  SaveProjectCommand
}; 