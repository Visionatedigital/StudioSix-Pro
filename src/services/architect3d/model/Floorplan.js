import {EventDispatcher} from 'three';
import {Corner} from './Corner.js';
import {Wall} from './Wall.js';
import {Room} from './Room.js';
import {EVENT_LOADED, EVENT_UPDATED, EVENT_NEW, EVENT_DELETED} from '../core/events.js';
import {Utils} from '../core/utils.js';

/**
 * A Floorplan represents a number of Walls, Corners and Rooms.
 */
export class Floorplan extends EventDispatcher
{
	constructor()
	{
		super();
		
		/** Array of walls. */
		this.walls = [];
		
		/** Array of corners. */
		this.corners = [];
		
		/** Array of rooms. */
		this.rooms = [];
		
		/** Floor textures. */
		this.floorTextures = {};
		
		/** Room meta data */
		this.metaroomsdata = {};
		
		/** New wall callbacks. */
		this.newWallCallbacks = null;
		
		/** New corner callbacks. */
		this.newCornerCallbacks = null;
		
		/** Deleted room callbacks. */
		this.deletedRoomCallbacks = null;
		
		/** Updated rooms callbacks. */
		this.updatedRoomCallbacks = null;
		
		/** Room loaded callbacks. */
		this.roomLoadedCallbacks = null;
	}

	/** Creates a new wall.
	 * @param {Corner} start Start corner.
	 * @param {Corner} end End corner.
	 * @returns {Wall} The new wall.
	 */
	newWall(start, end, controlPointA, controlPointB)
	{
		var wall = new Wall(start, end, controlPointA, controlPointB);
		this.walls.push(wall);
		
		wall.addEventListener(EVENT_DELETED, () => {
			Utils.removeValue(this.walls, wall);
			this.update();
		});
		
		this.update();
		this.dispatchEvent({type: EVENT_NEW, item: wall, action: 'wall'});
		return wall;
	}

	/** Creates a new corner.
	 * @param {Number} x X coordinate.
	 * @param {Number} y Y coordinate.
	 * @param {String} id Corner ID.
	 * @returns {Corner} The new corner.
	 */
	newCorner(x, y, id)
	{
		var corner = new Corner(this, x, y, id);
		this.corners.push(corner);
		
		corner.addEventListener(EVENT_DELETED, () => {
			Utils.removeValue(this.corners, corner);
		});
		
		this.dispatchEvent({type: EVENT_NEW, item: corner, action: 'corner'});
		return corner;
	}

	/** Gets the walls.
	 * @returns {Wall[]} The walls.
	 */
	getWalls()
	{
		return this.walls;
	}

	/** Gets the corners.
	 * @returns {Corner[]} The corners.
	 */
	getCorners()
	{
		return this.corners;
	}

	/** Gets the rooms.
	 * @returns {Room[]} The rooms.
	 */
	getRooms()
	{
		return this.rooms;
	}

	overlappedCorner(x, y, tolerance)
	{
		tolerance = tolerance || 25;
		for (var i = 0; i < this.corners.length; i++)
		{
			if (this.corners[i].distanceFrom({x: x, y: y}) < tolerance)
			{
				return this.corners[i];
			}
		}
		return null;
	}

	overlappedWall(x, y, tolerance)
	{
		tolerance = tolerance || 25;
		for (var i = 0; i < this.walls.length; i++)
		{
			if (this.walls[i].distanceFrom({x: x, y: y}) < tolerance)
			{
				return this.walls[i];
			}
		}
		return null;
	}

	// import and export -- TODO move to a separate class
	saveFloorplan()
	{
		var floorplan = {
			'corners': {},
			'walls': [],
			'wallTextures': [],
			'floorTextures': {},
			'metaroomsdata': this.metaroomsdata,
			'newFloorplanVersion': true
		};

		this.walls.forEach((wall) => {
			floorplan.walls.push({
				'corner1': wall.getStart().id,
				'corner2': wall.getEnd().id,
				'frontTexture': wall.frontTexture,
				'backTexture': wall.backTexture,
				'bezier': wall.wallType,
				'a': wall.a,
				'b': wall.b
			});
		});

		this.corners.forEach((corner) => {
			floorplan.corners[corner.id] = {
				'x': corner.x,
				'y': corner.y,
				'elevation': corner.elevation
			};
		});

		floorplan.floorTextures = this.floorTextures;

		return floorplan;
	}

	loadFloorplan(floorplan)
	{
		this.reset();

		var corners = {};
		if (floorplan == null || !('corners' in floorplan) || !('walls' in floorplan))
		{
			return;
		}

		for (var id in floorplan.corners)
		{
			var corner = floorplan.corners[id];
			corners[id] = this.newCorner(corner.x, corner.y, id);
			if('elevation' in corner)
			{
				corners[id].elevation = corner.elevation;
			}
		}

		var scope = this;
		floorplan.walls.forEach((wall) => {
			var newWall = scope.newWall(corners[wall.corner1], corners[wall.corner2]);
			if (wall.frontTexture)
			{
				newWall.frontTexture = wall.frontTexture;
			}
			if (wall.backTexture)
			{
				newWall.backTexture = wall.backTexture;
			}
			if('bezier' in wall && 'a' in wall && 'b' in wall)
			{
				newWall.wallType = wall.bezier;
				newWall.a = wall.a;
				newWall.b = wall.b;
			}
		});

		if ('floorTextures' in floorplan)
		{
			this.floorTextures = floorplan.floorTextures;
		}

		if('metaroomsdata' in floorplan)
		{
			this.metaroomsdata = floorplan.metaroomsdata;
		}

		this.update();
		this.dispatchEvent({type: EVENT_LOADED, item: this});
	}

	getFloorTexture(uuid)
	{
		if (uuid in this.floorTextures)
		{
			return this.floorTextures[uuid];
		}
		return null;
	}

	setFloorTexture(uuid, url, scale)
	{
		this.floorTextures[uuid] = {
			url: url,
			scale: scale
		};
	}

	/** clear out obsolete rooms and generate new ones */
	update(updateRoom=true)
	{
		if(!updateRoom)
		{
			return;
		}
		
		this.walls.forEach((wall) => {
			wall.resetFrontBack();
		});

		var scope = this;
		this.corners.forEach((corner) => {
			corner.clearAttachedRooms();
		});

		this.rooms = [];

		var roomCorners = this.findRooms(this.corners);

		roomCorners.forEach((corners) => {
			var room = new Room(scope, corners);
			scope.rooms.push(room);
		});

		this.assignOrphanWalls();

		this.dispatchEvent({type: EVENT_UPDATED, item: this});
	}

	assignOrphanWalls()
	{
		// kludge
		this.walls.forEach((wall) => {
			if (!wall.backEdge && !wall.frontEdge)
			{
				wall.orphan = true;
			}
		});
	}

	/**
	 * Find the "rooms" in our planar straight-line graph.
	 * Rooms are set of the smallest (by area) possible cycles in this graph.
	 * @param corners The corners of the floorplan.
	 * @returns The rooms, each room as an array of corners.
	 */
	findRooms(corners)
	{

		function _calculateTheta(previousCorner, currentCorner, nextCorner)
		{
			var theta = Utils.angle2pi(
				{x: previousCorner.x - currentCorner.x, y: previousCorner.y - currentCorner.y}, 
				{x: nextCorner.x - currentCorner.x, y: nextCorner.y - currentCorner.y});
			return theta;
		}

		function _removeDuplicateRooms(roomArray)
		{
			var results = [];
			var lookup = {};
			var hashFunc = function(corner) {
				return corner.id;
			};
			var sep = '-';
			for (var i = roomArray.length - 1; i >= 0; i--)
			{
				// rooms are cycles, shift it around to check duplicates
				var add = true;
				var room = roomArray[i];
				for (var j = 0; j < room.length; j++)
				{
					var roomShift = Utils.cycle(room, j);
					var str = Utils.map(roomShift, hashFunc).join(sep);
					if (lookup.hasOwnProperty(str))
					{
						add = false;
					}
				}
				if (add)
				{
					results.push(roomArray[i]);
					var str = Utils.map(room, hashFunc).join(sep);
					lookup[str] = true;
				}
			}
			return results;
		}

		function _findTightestCycle(firstCorner, secondCorner)
		{

			var stack = [];

			var next = {
				corner: secondCorner,
				previousCorner: firstCorner
			};
			var visited = {};
			visited[firstCorner.id] = true;

			while (next)
			{

				// update previous corner, current corner
				var currentCorner = next.corner;
				visited[currentCorner.id] = true;

				// did we make it back to the startCorner?
				if (next.corner === firstCorner && stack.length > 0)
				{
					// create a room  
					stack.push(next.corner);
					var room = Utils.map(stack, function(node) {
						return node.corner;
					});
					return room;
				}

				var addToStack = true;
				var nextCorners = currentCorner.adjacentCorners();

				for (var i = 0; i < nextCorners.length; i++)
				{
					var nextCorner = nextCorners[i];

					// skip back to previous corner
					if (nextCorner === next.previousCorner)
					{
						continue;
					}

					// if we haven't visited this corner yet
					if (!(nextCorner.id in visited))
					{
						// create a new item with this corner, continuing our cycle
						next = {
							corner: nextCorner,
							previousCorner: currentCorner
						};
						addToStack = true;
						break;
					}

					// if we have visited this corner, close the cycle
					else if (nextCorners.length === 2 && nextCorner === firstCorner)
					{
						// close the cycle
						next = {
							corner: nextCorner,
							previousCorner: currentCorner
						};
						addToStack = true;
						break;
					}
				}

				if (addToStack)
				{
					stack.push(next);
				}

				// if we are unable to find a next corner, we are done
				if (nextCorners.length < 2)
				{
					return [];
				}

				// if we didn't find a way to continue the cycle, follow another cycle

				// visit all other corners
				var remainingCorners = [];
				for (var i = 0; i < nextCorners.length; i++)
				{
					var nextCorner = nextCorners[i];
					if (!(nextCorner.id in visited) && nextCorner !== next.previousCorner)
					{
						remainingCorners.push(nextCorner);
					}
				}

				if (remainingCorners.length === 0)
				{
					return [];

				} else if (remainingCorners.length === 1)
				{
					var nextCorner = remainingCorners[0];
					// create a new item with this corner, continuing our cycle
					next = {
						corner: nextCorner,
						previousCorner: currentCorner
					};
				} else {
					// we have a choice of corners, choose the one which makes the smallest angle  
					var smallestTheta = 0;
					var selectedNextCorner = remainingCorners[0];

					for (var i = 0; i < remainingCorners.length; i++)
					{
						var nextCorner = remainingCorners[i];
						var theta = _calculateTheta(next.previousCorner, currentCorner, nextCorner);

						if (i === 0 || theta < smallestTheta)
						{
							smallestTheta = theta;
							selectedNextCorner = nextCorner;
						}
					}
					next = {
						corner: selectedNextCorner,
						previousCorner: currentCorner
					};
				}
			}

			return [];

		}

		// find cycles
		var visitedEdges = {};
		var rooms = [];
		for (var i = 0; i < corners.length; i++)
		{
			var firstCorner = corners[i];
			var adjacentCorners = firstCorner.adjacentCorners();
			for (var j = 0; j < adjacentCorners.length; j++)
			{
				var secondCorner = adjacentCorners[j];

				var wallEdgeId = firstCorner.id + ',' + secondCorner.id;
				var wallEdgeIdSwapped = secondCorner.id + ',' + firstCorner.id;

				if (wallEdgeId in visitedEdges || wallEdgeIdSwapped in visitedEdges)
				{
					continue;
				}

				var cycle = _findTightestCycle(firstCorner, secondCorner);
				if (cycle.length === 0)
				{
					continue;
				}

				var room = cycle;
				visitedEdges[wallEdgeId] = true;
				visitedEdges[wallEdgeIdSwapped] = true;

				rooms.push(room);
			}
		}

		// remove duplicates
		var uniqueRooms = _removeDuplicateRooms(rooms);
		//remove rooms with corners less than 3
		var validRooms = Utils.removeIf(uniqueRooms, function(room) {
			return room.length < 3;
		});

		// remove any rooms that overlap with other rooms
		for (var i = validRooms.length - 1; i >= 0; i--)
		{
			var room = validRooms[i];
			var corners = Utils.map(room, function(corner) {
				return {x: corner.x, y: corner.y};
			});
			var area = Utils.isClockwise(corners);

			if (area >= 0)
			{
				validRooms.splice(i, 1);
			}
		}
		return validRooms;
	}

	/** Removes all walls and corners. */
	reset()
	{
		var tmpCorners = this.corners.slice(0);
		var tmpWalls = this.walls.slice(0);
		tmpCorners.forEach((corner) => {
			corner.remove();
		});
		tmpWalls.forEach((wall) => {
			wall.remove();
		});
		this.corners = [];
		this.walls = [];
		this.rooms = [];
	}
}