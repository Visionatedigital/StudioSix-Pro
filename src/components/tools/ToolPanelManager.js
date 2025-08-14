import React from 'react';
import DraggableToolPanel from './DraggableToolPanel';
import { WallTool, SlabTool, DoorTool, WindowTool, RoofTool, StairTool } from '../tools';

/**
 * Centralized tool panel manager that wraps all tools with dragging functionality
 */
const ToolPanelManager = ({
  selectedTool,
  selectedObject,
  theme,
  freecadObjects,
  containerBounds,
  // Wall tool handlers
  wallParams,
  onWallParamsChange,
  onCreateWall,
  onUpdateWall,
  onCancelWallTool,
  // Slab tool handlers
  onCreateSlab,
  onUpdateSlab,
  onCancelSlabTool,
  // Door tool handlers
  doorParams,
  onDoorParamsChange,
  onCreateDoor,
  onUpdateDoor,
  onCancelDoorTool,
  // Window tool handlers
  onCreateWindow,
  onUpdateWindow,
  onCancelWindowTool,
  // Roof tool handlers
  onCreateRoof,
  onUpdateRoof,
  onCancelRoofTool,
  // Stair tool handlers
  onCreateStair,
  onUpdateStair,
  onCancelStairTool,
}) => {
  // Tool configuration - defines size and properties for each tool
  const toolConfig = {
    wall: { width: 320, height: 500 },
    slab: { width: 320, height: 500 },
    door: { width: 340, height: 550 },
    window: { width: 360, height: 600 },
    roof: { width: 380, height: 650 },
    stair: { width: 400, height: 700 }
  };

  const baseClassName = "rounded-lg shadow-2xl border transition-all duration-300 backdrop-blur-md";
  const themeClassName = theme === 'dark' 
    ? 'bg-gray-900/95 border-gray-700/50' 
    : 'bg-white/95 border-gray-300/50';

  return (
    <>
      {/* Wall Tool */}
      <DraggableToolPanel
        isActive={selectedTool === 'wall'}
        width={toolConfig.wall.width}
        height={toolConfig.wall.height}
        className={`wall-tool-panel ${baseClassName} ${themeClassName}`}
        style={{ overflowY: 'auto' }}
        containerBounds={containerBounds}
      >
        <WallTool
          isActive={selectedTool === 'wall'}
          selectedObject={selectedObject}
          wallParams={wallParams}
          onWallParamsChange={onWallParamsChange}
          onCreateWall={onCreateWall}
          onUpdateWall={onUpdateWall}
          onCancel={onCancelWallTool}
          theme={theme}
        />
      </DraggableToolPanel>

      {/* Slab Tool */}
      <DraggableToolPanel
        isActive={selectedTool === 'slab'}
        width={toolConfig.slab.width}
        height={toolConfig.slab.height}
        className={`slab-tool-panel ${baseClassName} ${themeClassName}`}
        style={{ overflowY: 'auto' }}
      >
        <SlabTool
          isActive={selectedTool === 'slab'}
          selectedObject={selectedObject}
          onCreateSlab={onCreateSlab}
          onUpdateSlab={onUpdateSlab}
          onCancel={onCancelSlabTool}
          theme={theme}
          freecadObjects={freecadObjects || []}
        />
      </DraggableToolPanel>

      {/* Door Tool - Show when door tool is selected OR when a door object is selected */}
      <DraggableToolPanel
        isActive={selectedTool === 'door' || (selectedObject && selectedObject.type === 'door')}
        width={toolConfig.door.width}
        height={toolConfig.door.height}
        className={`door-tool-panel ${baseClassName} ${themeClassName}`}
        style={{ overflowY: 'auto' }}
      >
        <DoorTool
          isActive={selectedTool === 'door' || (selectedObject && selectedObject.type === 'door')}
          selectedObject={selectedObject}
          onCreateDoor={onCreateDoor}
          onUpdateDoor={onUpdateDoor}
          onCancel={onCancelDoorTool}
          theme={theme}
          freecadObjects={freecadObjects || []}
          doorParams={doorParams}
          onDoorParamsChange={onDoorParamsChange}
        />
      </DraggableToolPanel>

      {/* Window Tool */}
      <DraggableToolPanel
        isActive={selectedTool === 'window'}
        width={toolConfig.window.width}
        height={toolConfig.window.height}
        className={`window-tool-panel ${baseClassName} ${themeClassName}`}
        style={{ overflowY: 'auto' }}
      >
        <WindowTool
          isActive={selectedTool === 'window'}
          selectedObject={selectedObject}
          onCreateWindow={onCreateWindow}
          onUpdateWindow={onUpdateWindow}
          onCancel={onCancelWindowTool}
          theme={theme}
          freecadObjects={freecadObjects || []}
        />
      </DraggableToolPanel>

      {/* Roof Tool */}
      <DraggableToolPanel
        isActive={selectedTool === 'roof'}
        width={toolConfig.roof.width}
        height={toolConfig.roof.height}
        className={`roof-tool-panel ${baseClassName} ${themeClassName}`}
        style={{ overflowY: 'auto' }}
      >
        <RoofTool
          isActive={selectedTool === 'roof'}
          selectedObject={selectedObject}
          onCreateRoof={onCreateRoof}
          onUpdateRoof={onUpdateRoof}
          onCancel={onCancelRoofTool}
          theme={theme}
          freecadObjects={freecadObjects || []}
        />
      </DraggableToolPanel>

      {/* Stair Tool */}
      <DraggableToolPanel
        isActive={selectedTool === 'stair'}
        width={toolConfig.stair.width}
        height={toolConfig.stair.height}
        className={`stair-tool-panel ${baseClassName} ${themeClassName}`}
        style={{ overflowY: 'auto' }}
      >
        <StairTool
          isActive={selectedTool === 'stair'}
          selectedObject={selectedObject}
          onCreateStair={onCreateStair}
          onUpdateStair={onUpdateStair}
          onCancel={onCancelStairTool}
          theme={theme}
          freecadObjects={freecadObjects || []}
        />
      </DraggableToolPanel>
    </>
  );
};

export default ToolPanelManager; 