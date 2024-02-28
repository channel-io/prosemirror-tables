"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  CellBookmark: () => CellBookmark,
  CellSelection: () => CellSelection,
  TableMap: () => TableMap,
  __clipCells: () => clipCells,
  __insertCells: () => insertCells,
  __pastedCells: () => pastedCells,
  addColumn: () => addColumn,
  addColumnAfter: () => addColumnAfter,
  addColumnBefore: () => addColumnBefore,
  addRow: () => addRow,
  addRowAfter: () => addRowAfter,
  addRowBefore: () => addRowBefore,
  cellAround: () => cellAround,
  colCount: () => colCount,
  columnIsHeader: () => columnIsHeader,
  deleteColumn: () => deleteColumn,
  deleteRow: () => deleteRow,
  deleteTable: () => deleteTable,
  findCell: () => findCell,
  fixTables: () => fixTables,
  fixTablesKey: () => fixTablesKey,
  goToNextCell: () => goToNextCell,
  handlePaste: () => handlePaste,
  inSameTable: () => inSameTable,
  isInTable: () => isInTable,
  mergeCells: () => mergeCells,
  moveCellForward: () => moveCellForward,
  nextCell: () => nextCell,
  pointsAtCell: () => pointsAtCell,
  removeColumn: () => removeColumn,
  removeRow: () => removeRow,
  rowIsHeader: () => rowIsHeader,
  selectedRect: () => selectedRect,
  selectionCell: () => selectionCell,
  setCellAttr: () => setCellAttr,
  tableEditing: () => tableEditing,
  tableEditingKey: () => tableEditingKey,
  tableNodeTypes: () => tableNodeTypes,
  toggleHeader: () => toggleHeader,
  toggleHeaderCell: () => toggleHeaderCell,
  toggleHeaderColumn: () => toggleHeaderColumn,
  toggleHeaderRow: () => toggleHeaderRow
});
module.exports = __toCommonJS(src_exports);
var import_prosemirror_state6 = require("prosemirror-state");

// src/cellselection.ts
var import_prosemirror_model = require("prosemirror-model");
var import_prosemirror_state2 = require("prosemirror-state");
var import_prosemirror_view = require("prosemirror-view");

// src/tablemap.ts
var readFromCache;
var addToCache;
if (typeof WeakMap != "undefined") {
  let cache = /* @__PURE__ */ new WeakMap();
  readFromCache = (key) => cache.get(key);
  addToCache = (key, value) => {
    cache.set(key, value);
    return value;
  };
} else {
  const cache = [];
  const cacheSize = 10;
  let cachePos = 0;
  readFromCache = (key) => {
    for (let i = 0; i < cache.length; i += 2)
      if (cache[i] == key)
        return cache[i + 1];
  };
  addToCache = (key, value) => {
    if (cachePos == cacheSize)
      cachePos = 0;
    cache[cachePos++] = key;
    return cache[cachePos++] = value;
  };
}
var TableMap = class {
  constructor(width, height, map, problems) {
    this.width = width;
    this.height = height;
    this.map = map;
    this.problems = problems;
  }
  // Find the dimensions of the cell at the given position.
  findCell(pos) {
    for (let i = 0; i < this.map.length; i++) {
      const curPos = this.map[i];
      if (curPos != pos)
        continue;
      const left = i % this.width;
      const top = i / this.width | 0;
      let right = left + 1;
      let bottom = top + 1;
      for (let j = 1; right < this.width && this.map[i + j] == curPos; j++) {
        right++;
      }
      for (let j = 1; bottom < this.height && this.map[i + this.width * j] == curPos; j++) {
        bottom++;
      }
      return { left, top, right, bottom };
    }
    throw new RangeError(`No cell with offset ${pos} found`);
  }
  // Find the left side of the cell at the given position.
  colCount(pos) {
    for (let i = 0; i < this.map.length; i++) {
      if (this.map[i] == pos) {
        return i % this.width;
      }
    }
    throw new RangeError(`No cell with offset ${pos} found`);
  }
  // Find the next cell in the given direction, starting from the cell
  // at `pos`, if any.
  nextCell(pos, axis, dir) {
    const { left, right, top, bottom } = this.findCell(pos);
    if (axis == "horiz") {
      if (dir < 0 ? left == 0 : right == this.width)
        return null;
      return this.map[top * this.width + (dir < 0 ? left - 1 : right)];
    } else {
      if (dir < 0 ? top == 0 : bottom == this.height)
        return null;
      return this.map[left + this.width * (dir < 0 ? top - 1 : bottom)];
    }
  }
  // Get the rectangle spanning the two given cells.
  rectBetween(a, b) {
    const {
      left: leftA,
      right: rightA,
      top: topA,
      bottom: bottomA
    } = this.findCell(a);
    const {
      left: leftB,
      right: rightB,
      top: topB,
      bottom: bottomB
    } = this.findCell(b);
    return {
      left: Math.min(leftA, leftB),
      top: Math.min(topA, topB),
      right: Math.max(rightA, rightB),
      bottom: Math.max(bottomA, bottomB)
    };
  }
  // Return the position of all cells that have the top left corner in
  // the given rectangle.
  cellsInRect(rect) {
    const result = [];
    const seen = {};
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const index = row * this.width + col;
        const pos = this.map[index];
        if (seen[pos])
          continue;
        seen[pos] = true;
        if (col == rect.left && col && this.map[index - 1] == pos || row == rect.top && row && this.map[index - this.width] == pos) {
          continue;
        }
        result.push(pos);
      }
    }
    return result;
  }
  // Return the position at which the cell at the given row and column
  // starts, or would start, if a cell started there.
  positionAt(row, col, table) {
    for (let i = 0, rowStart = 0; ; i++) {
      const rowEnd = rowStart + table.child(i).nodeSize;
      if (i == row) {
        let index = col + row * this.width;
        const rowEndIndex = (row + 1) * this.width;
        while (index < rowEndIndex && this.map[index] < rowStart)
          index++;
        return index == rowEndIndex ? rowEnd - 1 : this.map[index];
      }
      rowStart = rowEnd;
    }
  }
  // Find the table map for the given table node.
  static get(table) {
    return readFromCache(table) || addToCache(table, computeMap(table));
  }
};
function computeMap(table) {
  if (table.type.spec.tableRole != "table")
    throw new RangeError("Not a table node: " + table.type.name);
  const width = findWidth(table), height = table.childCount;
  const map = [];
  let mapPos = 0;
  let problems = null;
  for (let i = 0, e = width * height; i < e; i++)
    map[i] = 0;
  for (let row = 0, pos = 0; row < height; row++) {
    const rowNode = table.child(row);
    pos++;
    for (let i = 0; ; i++) {
      while (mapPos < map.length && map[mapPos] != 0)
        mapPos++;
      if (i == rowNode.childCount)
        break;
      const cellNode = rowNode.child(i);
      for (let h = 0; h < 1; h++) {
        const start = mapPos + h * width;
        for (let w = 0; w < 1; w++) {
          if (map[start + w] == 0)
            map[start + w] = pos;
          else
            (problems || (problems = [])).push({
              type: "collision",
              row,
              pos,
              n: 1 - w
            });
        }
      }
      mapPos += 1;
      pos += cellNode.nodeSize;
    }
    const expectedPos = (row + 1) * width;
    let missing = 0;
    while (mapPos < expectedPos)
      if (map[mapPos++] == 0)
        missing++;
    if (missing)
      (problems || (problems = [])).push({ type: "missing", row, n: missing });
    pos++;
  }
  return new TableMap(width, height, map, problems);
}
function findWidth(table) {
  if (table.childCount === 0)
    return 0;
  let width = table.child(0).childCount;
  for (let row = 1; row < table.childCount; row++) {
    const rowNode = table.child(row);
    if (rowNode.childCount !== width) {
      console.warn("Inconsistent cell count in row", row);
      width = Math.max(width, rowNode.childCount);
    }
  }
  return width;
}

// src/util.ts
var import_prosemirror_state = require("prosemirror-state");

// src/schema.ts
function tableNodeTypes(schema) {
  let result = schema.cached.tableNodeTypes;
  if (!result) {
    result = schema.cached.tableNodeTypes = {};
    for (const name in schema.nodes) {
      const type = schema.nodes[name], role = type.spec.tableRole;
      if (role)
        result[role] = type;
    }
  }
  return result;
}

// src/util.ts
var tableEditingKey = new import_prosemirror_state.PluginKey("selectingCells");
function cellAround($pos) {
  for (let d = $pos.depth - 1; d > 0; d--)
    if ($pos.node(d).type.spec.tableRole == "row")
      return $pos.node(0).resolve($pos.before(d + 1));
  return null;
}
function isInTable(state) {
  const $head = state.selection.$head;
  for (let d = $head.depth; d > 0; d--)
    if ($head.node(d).type.spec.tableRole == "row")
      return true;
  return false;
}
function selectionCell(state) {
  const sel = state.selection;
  if ("$anchorCell" in sel && sel.$anchorCell) {
    return sel.$anchorCell.pos > sel.$headCell.pos ? sel.$anchorCell : sel.$headCell;
  } else if ("node" in sel && sel.node && sel.node.type.spec.tableRole == "cell") {
    return sel.$anchor;
  }
  const $cell = cellAround(sel.$head) || cellNear(sel.$head);
  if ($cell) {
    return $cell;
  }
  throw new RangeError(`No cell found around position ${sel.head}`);
}
function cellNear($pos) {
  for (let after = $pos.nodeAfter, pos = $pos.pos; after; after = after.firstChild, pos++) {
    const role = after.type.spec.tableRole;
    if (role == "cell" || role == "header_cell")
      return $pos.doc.resolve(pos);
  }
  for (let before = $pos.nodeBefore, pos = $pos.pos; before; before = before.lastChild, pos--) {
    const role = before.type.spec.tableRole;
    if (role == "cell" || role == "header_cell")
      return $pos.doc.resolve(pos - before.nodeSize);
  }
}
function pointsAtCell($pos) {
  return $pos.parent.type.spec.tableRole == "row" && !!$pos.nodeAfter;
}
function moveCellForward($pos) {
  return $pos.node(0).resolve($pos.pos + $pos.nodeAfter.nodeSize);
}
function inSameTable($cellA, $cellB) {
  return $cellA.depth == $cellB.depth && $cellA.pos >= $cellB.start(-1) && $cellA.pos <= $cellB.end(-1);
}
function findCell($pos) {
  return TableMap.get($pos.node(-1)).findCell($pos.pos - $pos.start(-1));
}
function colCount($pos) {
  return TableMap.get($pos.node(-1)).colCount($pos.pos - $pos.start(-1));
}
function nextCell($pos, axis, dir) {
  const table = $pos.node(-1);
  const map = TableMap.get(table);
  const tableStart = $pos.start(-1);
  const moved = map.nextCell($pos.pos - tableStart, axis, dir);
  return moved == null ? null : $pos.node(0).resolve(tableStart + moved);
}
function columnIsHeader(map, table, col) {
  const headerCell = tableNodeTypes(table.type.schema).header_cell;
  for (let row = 0; row < map.height; row++)
    if (table.nodeAt(map.map[col + row * map.width]).type != headerCell)
      return false;
  return true;
}

// src/cellselection.ts
var CellSelection = class _CellSelection extends import_prosemirror_state2.Selection {
  // A table selection is identified by its anchor and head cells. The
  // positions given to this constructor should point _before_ two
  // cells in the same table. They may be the same, to select a single
  // cell.
  constructor($anchorCell, $headCell = $anchorCell) {
    const table = $anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = $anchorCell.start(-1);
    const rect = map.rectBetween(
      $anchorCell.pos - tableStart,
      $headCell.pos - tableStart
    );
    const doc = $anchorCell.node(0);
    const cells = map.cellsInRect(rect).filter((p) => p != $headCell.pos - tableStart);
    cells.unshift($headCell.pos - tableStart);
    const ranges = cells.map((pos) => {
      const cell = table.nodeAt(pos);
      if (!cell) {
        throw RangeError(`No cell with offset ${pos} found`);
      }
      const from = tableStart + pos + 1;
      return new import_prosemirror_state2.SelectionRange(
        doc.resolve(from),
        doc.resolve(from + cell.content.size)
      );
    });
    super(ranges[0].$from, ranges[0].$to, ranges);
    this.$anchorCell = $anchorCell;
    this.$headCell = $headCell;
  }
  map(doc, mapping) {
    const $anchorCell = doc.resolve(mapping.map(this.$anchorCell.pos));
    const $headCell = doc.resolve(mapping.map(this.$headCell.pos));
    if (pointsAtCell($anchorCell) && pointsAtCell($headCell) && inSameTable($anchorCell, $headCell)) {
      const tableChanged = this.$anchorCell.node(-1) != $anchorCell.node(-1);
      if (tableChanged && this.isRowSelection())
        return _CellSelection.rowSelection($anchorCell, $headCell);
      else if (tableChanged && this.isColSelection())
        return _CellSelection.colSelection($anchorCell, $headCell);
      else
        return new _CellSelection($anchorCell, $headCell);
    }
    return import_prosemirror_state2.TextSelection.between($anchorCell, $headCell);
  }
  // Returns a rectangular slice of table rows containing the selected
  // cells.
  content() {
    const table = this.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = this.$anchorCell.start(-1);
    const rect = map.rectBetween(
      this.$anchorCell.pos - tableStart,
      this.$headCell.pos - tableStart
    );
    const seen = {};
    const rows = [];
    for (let row = rect.top; row < rect.bottom; row++) {
      const rowContent = [];
      for (let index = row * map.width + rect.left, col = rect.left; col < rect.right; col++, index++) {
        const pos = map.map[index];
        if (seen[pos])
          continue;
        seen[pos] = true;
        const cellRect = map.findCell(pos);
        let cell = table.nodeAt(pos);
        if (!cell) {
          throw RangeError(`No cell with offset ${pos} found`);
        }
        const extraLeft = rect.left - cellRect.left;
        const extraRight = cellRect.right - rect.right;
        if (extraLeft > 0 || extraRight > 0) {
          const attrs = cell.attrs;
          if (cellRect.left < rect.left) {
            cell = cell.type.createAndFill(attrs);
            if (!cell) {
              throw RangeError(
                `Could not create cell with attrs ${JSON.stringify(attrs)}`
              );
            }
          } else {
            cell = cell.type.create(attrs, cell.content);
          }
        }
        if (cellRect.top < rect.top || cellRect.bottom > rect.bottom) {
          const attrs = {
            ...cell.attrs
          };
          if (cellRect.top < rect.top) {
            cell = cell.type.createAndFill(attrs);
          } else {
            cell = cell.type.create(attrs, cell.content);
          }
        }
        rowContent.push(cell);
      }
      rows.push(table.child(row).copy(import_prosemirror_model.Fragment.from(rowContent)));
    }
    const fragment = this.isColSelection() && this.isRowSelection() ? table : rows;
    return new import_prosemirror_model.Slice(import_prosemirror_model.Fragment.from(fragment), 1, 1);
  }
  replace(tr, content = import_prosemirror_model.Slice.empty) {
    const mapFrom = tr.steps.length, ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i], mapping = tr.mapping.slice(mapFrom);
      tr.replace(
        mapping.map($from.pos),
        mapping.map($to.pos),
        i ? import_prosemirror_model.Slice.empty : content
      );
    }
    const sel = import_prosemirror_state2.Selection.findFrom(
      tr.doc.resolve(tr.mapping.slice(mapFrom).map(this.to)),
      -1
    );
    if (sel)
      tr.setSelection(sel);
  }
  replaceWith(tr, node) {
    this.replace(tr, new import_prosemirror_model.Slice(import_prosemirror_model.Fragment.from(node), 0, 0));
  }
  forEachCell(f) {
    const table = this.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = this.$anchorCell.start(-1);
    const cells = map.cellsInRect(
      map.rectBetween(
        this.$anchorCell.pos - tableStart,
        this.$headCell.pos - tableStart
      )
    );
    for (let i = 0; i < cells.length; i++) {
      f(table.nodeAt(cells[i]), tableStart + cells[i]);
    }
  }
  // True if this selection goes all the way from the top to the
  // bottom of the table.
  isColSelection() {
    const anchorTop = this.$anchorCell.index(-1);
    const headTop = this.$headCell.index(-1);
    if (Math.min(anchorTop, headTop) > 0)
      return false;
    const anchorBottom = anchorTop + (this.$anchorCell.nodeAfter ? 1 : 0);
    const headBottom = headTop + (this.$headCell.nodeAfter ? 1 : 0);
    return Math.max(anchorBottom, headBottom) == this.$headCell.node(-1).childCount;
  }
  // Returns the smallest column selection that covers the given anchor
  // and head cell.
  static colSelection($anchorCell, $headCell = $anchorCell) {
    const table = $anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = $anchorCell.start(-1);
    const anchorRect = map.findCell($anchorCell.pos - tableStart);
    const headRect = map.findCell($headCell.pos - tableStart);
    const doc = $anchorCell.node(0);
    if (anchorRect.top <= headRect.top) {
      if (anchorRect.top > 0)
        $anchorCell = doc.resolve(tableStart + map.map[anchorRect.left]);
      if (headRect.bottom < map.height)
        $headCell = doc.resolve(
          tableStart + map.map[map.width * (map.height - 1) + headRect.right - 1]
        );
    } else {
      if (headRect.top > 0)
        $headCell = doc.resolve(tableStart + map.map[headRect.left]);
      if (anchorRect.bottom < map.height)
        $anchorCell = doc.resolve(
          tableStart + map.map[map.width * (map.height - 1) + anchorRect.right - 1]
        );
    }
    return new _CellSelection($anchorCell, $headCell);
  }
  // True if this selection goes all the way from the left to the
  // right of the table.
  isRowSelection() {
    const table = this.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = this.$anchorCell.start(-1);
    const anchorLeft = map.colCount(this.$anchorCell.pos - tableStart);
    const headLeft = map.colCount(this.$headCell.pos - tableStart);
    if (Math.min(anchorLeft, headLeft) > 0)
      return false;
    const anchorRight = anchorLeft + (this.$anchorCell.nodeAfter ? 1 : 0);
    const headRight = headLeft + (this.$headCell.nodeAfter ? 1 : 0);
    return Math.max(anchorRight, headRight) == map.width;
  }
  eq(other) {
    return other instanceof _CellSelection && other.$anchorCell.pos == this.$anchorCell.pos && other.$headCell.pos == this.$headCell.pos;
  }
  // Returns the smallest row selection that covers the given anchor
  // and head cell.
  static rowSelection($anchorCell, $headCell = $anchorCell) {
    const table = $anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = $anchorCell.start(-1);
    const anchorRect = map.findCell($anchorCell.pos - tableStart);
    const headRect = map.findCell($headCell.pos - tableStart);
    const doc = $anchorCell.node(0);
    if (anchorRect.left <= headRect.left) {
      if (anchorRect.left > 0)
        $anchorCell = doc.resolve(
          tableStart + map.map[anchorRect.top * map.width]
        );
      if (headRect.right < map.width)
        $headCell = doc.resolve(
          tableStart + map.map[map.width * (headRect.top + 1) - 1]
        );
    } else {
      if (headRect.left > 0)
        $headCell = doc.resolve(tableStart + map.map[headRect.top * map.width]);
      if (anchorRect.right < map.width)
        $anchorCell = doc.resolve(
          tableStart + map.map[map.width * (anchorRect.top + 1) - 1]
        );
    }
    return new _CellSelection($anchorCell, $headCell);
  }
  toJSON() {
    return {
      type: "cell",
      anchor: this.$anchorCell.pos,
      head: this.$headCell.pos
    };
  }
  static fromJSON(doc, json) {
    return new _CellSelection(doc.resolve(json.anchor), doc.resolve(json.head));
  }
  static create(doc, anchorCell, headCell = anchorCell) {
    return new _CellSelection(doc.resolve(anchorCell), doc.resolve(headCell));
  }
  getBookmark() {
    return new CellBookmark(this.$anchorCell.pos, this.$headCell.pos);
  }
};
CellSelection.prototype.visible = false;
import_prosemirror_state2.Selection.jsonID("cell", CellSelection);
var CellBookmark = class _CellBookmark {
  constructor(anchor, head) {
    this.anchor = anchor;
    this.head = head;
  }
  map(mapping) {
    return new _CellBookmark(mapping.map(this.anchor), mapping.map(this.head));
  }
  resolve(doc) {
    const $anchorCell = doc.resolve(this.anchor), $headCell = doc.resolve(this.head);
    if ($anchorCell.parent.type.spec.tableRole == "row" && $headCell.parent.type.spec.tableRole == "row" && $anchorCell.index() < $anchorCell.parent.childCount && $headCell.index() < $headCell.parent.childCount && inSameTable($anchorCell, $headCell))
      return new CellSelection($anchorCell, $headCell);
    else
      return import_prosemirror_state2.Selection.near($headCell, 1);
  }
};
function drawCellSelection(state) {
  if (!(state.selection instanceof CellSelection))
    return null;
  const cells = [];
  state.selection.forEachCell((node, pos) => {
    cells.push(
      import_prosemirror_view.Decoration.node(pos, pos + node.nodeSize, { class: "selectedCell" })
    );
  });
  return import_prosemirror_view.DecorationSet.create(state.doc, cells);
}
function isCellBoundarySelection({ $from, $to }) {
  if ($from.pos == $to.pos || $from.pos < $from.pos - 6)
    return false;
  let afterFrom = $from.pos;
  let beforeTo = $to.pos;
  let depth = $from.depth;
  for (; depth >= 0; depth--, afterFrom++)
    if ($from.after(depth + 1) < $from.end(depth))
      break;
  for (let d = $to.depth; d >= 0; d--, beforeTo--)
    if ($to.before(d + 1) > $to.start(d))
      break;
  return afterFrom == beforeTo && /row|table/.test($from.node(depth).type.spec.tableRole);
}
function isTextSelectionAcrossCells({ $from, $to }) {
  let fromCellBoundaryNode;
  let toCellBoundaryNode;
  for (let i = $from.depth; i > 0; i--) {
    const node = $from.node(i);
    if (node.type.spec.tableRole === "cell" || node.type.spec.tableRole === "header_cell") {
      fromCellBoundaryNode = node;
      break;
    }
  }
  for (let i = $to.depth; i > 0; i--) {
    const node = $to.node(i);
    if (node.type.spec.tableRole === "cell" || node.type.spec.tableRole === "header_cell") {
      toCellBoundaryNode = node;
      break;
    }
  }
  return fromCellBoundaryNode !== toCellBoundaryNode && $to.parentOffset === 0;
}
function normalizeSelection(state, tr, allowTableNodeSelection) {
  const sel = (tr || state).selection;
  const doc = (tr || state).doc;
  let normalize;
  let role;
  if (sel instanceof import_prosemirror_state2.NodeSelection && (role = sel.node.type.spec.tableRole)) {
    if (role == "cell" || role == "header_cell") {
      normalize = CellSelection.create(doc, sel.from);
    } else if (role == "row") {
      const $cell = doc.resolve(sel.from + 1);
      normalize = CellSelection.rowSelection($cell, $cell);
    } else if (!allowTableNodeSelection) {
      const map = TableMap.get(sel.node);
      const start = sel.from + 1;
      const lastCell = start + map.map[map.width * map.height - 1];
      normalize = CellSelection.create(doc, start + 1, lastCell);
    }
  } else if (sel instanceof import_prosemirror_state2.TextSelection && isCellBoundarySelection(sel)) {
    normalize = import_prosemirror_state2.TextSelection.create(doc, sel.from);
  } else if (sel instanceof import_prosemirror_state2.TextSelection && isTextSelectionAcrossCells(sel)) {
    normalize = import_prosemirror_state2.TextSelection.create(doc, sel.$from.start(), sel.$from.end());
  }
  if (normalize)
    (tr || (tr = state.tr)).setSelection(normalize);
  return tr;
}

// src/fixtables.ts
var import_prosemirror_state3 = require("prosemirror-state");
var fixTablesKey = new import_prosemirror_state3.PluginKey("fix-tables");
function changedDescendants(old, cur, offset, f) {
  const oldSize = old.childCount, curSize = cur.childCount;
  outer:
    for (let i = 0, j = 0; i < curSize; i++) {
      const child = cur.child(i);
      for (let scan = j, e = Math.min(oldSize, i + 3); scan < e; scan++) {
        if (old.child(scan) == child) {
          j = scan + 1;
          offset += child.nodeSize;
          continue outer;
        }
      }
      f(child, offset);
      if (j < oldSize && old.child(j).sameMarkup(child))
        changedDescendants(old.child(j), child, offset + 1, f);
      else
        child.nodesBetween(0, child.content.size, f, offset + 1);
      offset += child.nodeSize;
    }
}
function fixTables(state, oldState) {
  let tr;
  const check = (node, pos) => {
    if (node.type.spec.tableRole == "table")
      tr = fixTable(state, node, pos, tr);
  };
  if (!oldState)
    state.doc.descendants(check);
  else if (oldState.doc != state.doc)
    changedDescendants(oldState.doc, state.doc, 0, check);
  return tr;
}
function fixTable(state, table, tablePos, tr) {
  const map = TableMap.get(table);
  if (!map.problems)
    return tr;
  if (!tr)
    tr = state.tr;
  const mustAdd = [];
  for (let i = 0; i < map.height; i++)
    mustAdd.push(0);
  for (let i = 0; i < map.problems.length; i++) {
    const prob = map.problems[i];
    if (prob.type == "collision") {
      const cell = table.nodeAt(prob.pos);
      if (!cell)
        continue;
    } else if (prob.type == "missing") {
      mustAdd[prob.row] += prob.n;
    }
  }
  let first, last;
  for (let i = 0; i < mustAdd.length; i++)
    if (mustAdd[i]) {
      if (first == null)
        first = i;
      last = i;
    }
  for (let i = 0, pos = tablePos + 1; i < map.height; i++) {
    const row = table.child(i);
    const end = pos + row.nodeSize;
    const add = mustAdd[i];
    if (add > 0) {
      let role = "cell";
      if (row.firstChild) {
        role = row.firstChild.type.spec.tableRole;
      }
      const nodes = [];
      for (let j = 0; j < add; j++) {
        const node = tableNodeTypes(state.schema)[role].createAndFill();
        if (node)
          nodes.push(node);
      }
      const side = (i == 0 || first == i - 1) && last == i ? pos + 1 : end - 1;
      tr.insert(tr.mapping.map(side), nodes);
    }
    pos = end;
  }
  return tr.setMeta(fixTablesKey, { fixTables: true });
}

// src/input.ts
var import_prosemirror_model3 = require("prosemirror-model");
var import_prosemirror_state4 = require("prosemirror-state");
var import_prosemirror_keymap = require("prosemirror-keymap");

// src/copypaste.ts
var import_prosemirror_model2 = require("prosemirror-model");
var import_prosemirror_transform = require("prosemirror-transform");
function pastedCells(slice) {
  if (!slice.size)
    return null;
  let { content, openStart, openEnd } = slice;
  while (content.childCount == 1 && (openStart > 0 && openEnd > 0 || content.child(0).type.spec.tableRole == "table")) {
    openStart--;
    openEnd--;
    content = content.child(0).content;
  }
  const first = content.child(0);
  const role = first.type.spec.tableRole;
  const schema = first.type.schema, rows = [];
  if (role == "row") {
    for (let i = 0; i < content.childCount; i++) {
      let cells = content.child(i).content;
      const left = i ? 0 : Math.max(0, openStart - 1);
      const right = i < content.childCount - 1 ? 0 : Math.max(0, openEnd - 1);
      if (left || right)
        cells = fitSlice(
          tableNodeTypes(schema).row,
          new import_prosemirror_model2.Slice(cells, left, right)
        ).content;
      rows.push(cells);
    }
  } else if (role == "cell" || role == "header_cell") {
    rows.push(
      openStart || openEnd ? fitSlice(
        tableNodeTypes(schema).row,
        new import_prosemirror_model2.Slice(content, openStart, openEnd)
      ).content : content
    );
  } else {
    return null;
  }
  return ensureRectangular(schema, rows);
}
function ensureRectangular(schema, rows) {
  let maxWidth = 0;
  rows.forEach((row) => {
    maxWidth = Math.max(maxWidth, row.childCount);
  });
  rows.forEach((row, rowIndex) => {
    const shortfall = maxWidth - row.childCount;
    if (shortfall > 0) {
      const emptyCells = Array.from(
        { length: shortfall },
        () => tableNodeTypes(schema).cell.createAndFill()
      );
      rows[rowIndex] = row.append(import_prosemirror_model2.Fragment.from(emptyCells));
    }
  });
  return { height: rows.length, width: maxWidth, rows };
}
function fitSlice(nodeType, slice) {
  const node = nodeType.createAndFill();
  const tr = new import_prosemirror_transform.Transform(node).replace(0, node.content.size, slice);
  return tr.doc;
}
function clipCells({ width, height, rows }, newWidth, newHeight) {
  const newRows = [];
  for (let row = 0; row < newHeight; row++) {
    const newRow = [];
    const originalRow = rows[row % height];
    for (let col = 0; col < newWidth; col++) {
      if (col < originalRow.childCount) {
        newRow.push(originalRow.child(col));
      } else if (originalRow.childCount > 0) {
        const lastCell = originalRow.child(originalRow.childCount - 1);
        newRow.push(lastCell.copy(lastCell.content));
      }
    }
    newRows.push(import_prosemirror_model2.Fragment.from(newRow));
  }
  return {
    width: newWidth,
    height: newHeight,
    rows: newRows
  };
}
function growTable(tr, map, table, start, width, height, mapFrom) {
  const schema = tr.doc.type.schema;
  const types = tableNodeTypes(schema);
  let empty;
  let emptyHead;
  if (width > map.width) {
    for (let row = 0, rowEnd = 0; row < map.height; row++) {
      const rowNode = table.child(row);
      rowEnd += rowNode.nodeSize;
      const cells = [];
      let add;
      if (rowNode.lastChild == null || rowNode.lastChild.type == types.cell)
        add = empty || (empty = types.cell.createAndFill());
      else
        add = emptyHead || (emptyHead = types.header_cell.createAndFill());
      for (let i = map.width; i < width; i++)
        cells.push(add);
      tr.insert(tr.mapping.slice(mapFrom).map(rowEnd - 1 + start), cells);
    }
  }
  if (height > map.height) {
    const cells = [];
    for (let i = 0, start2 = (map.height - 1) * map.width; i < Math.max(map.width, width); i++) {
      const header = i >= map.width ? false : table.nodeAt(map.map[start2 + i]).type == types.header_cell;
      cells.push(
        header ? emptyHead || (emptyHead = types.header_cell.createAndFill()) : empty || (empty = types.cell.createAndFill())
      );
    }
    const emptyRow = types.row.create(null, import_prosemirror_model2.Fragment.from(cells)), rows = [];
    for (let i = map.height; i < height; i++)
      rows.push(emptyRow);
    tr.insert(tr.mapping.slice(mapFrom).map(start + table.nodeSize - 2), rows);
  }
  return !!(empty || emptyHead);
}
function insertCells(state, dispatch, tableStart, rect, cells) {
  let table = tableStart ? state.doc.nodeAt(tableStart - 1) : state.doc;
  if (!table) {
    throw new Error("No table found");
  }
  let map = TableMap.get(table);
  const { top, left } = rect;
  const right = left + cells.width, bottom = top + cells.height;
  const tr = state.tr;
  let mapFrom = 0;
  function recomp() {
    table = tableStart ? tr.doc.nodeAt(tableStart - 1) : tr.doc;
    if (!table) {
      throw new Error("No table found");
    }
    map = TableMap.get(table);
    mapFrom = tr.mapping.maps.length;
  }
  if (growTable(tr, map, table, tableStart, right, bottom, mapFrom))
    recomp();
  for (let row = top; row < bottom; row++) {
    const from = map.positionAt(row, left, table), to = map.positionAt(row, right, table);
    tr.replace(
      tr.mapping.slice(mapFrom).map(from + tableStart),
      tr.mapping.slice(mapFrom).map(to + tableStart),
      new import_prosemirror_model2.Slice(cells.rows[row - top], 0, 0)
    );
  }
  recomp();
  tr.setSelection(
    new CellSelection(
      tr.doc.resolve(tableStart + map.positionAt(top, left, table)),
      tr.doc.resolve(tableStart + map.positionAt(bottom - 1, right - 1, table))
    )
  );
  dispatch(tr);
}

// src/input.ts
var handleKeyDown = (0, import_prosemirror_keymap.keydownHandler)({
  ArrowLeft: arrow("horiz", -1),
  ArrowRight: arrow("horiz", 1),
  ArrowUp: arrow("vert", -1),
  ArrowDown: arrow("vert", 1),
  "Shift-ArrowLeft": shiftArrow("horiz", -1),
  "Shift-ArrowRight": shiftArrow("horiz", 1),
  "Shift-ArrowUp": shiftArrow("vert", -1),
  "Shift-ArrowDown": shiftArrow("vert", 1),
  Backspace: deleteCellSelection,
  "Mod-Backspace": deleteCellSelection,
  Delete: deleteCellSelection,
  "Mod-Delete": deleteCellSelection
});
function maybeSetSelection(state, dispatch, selection) {
  if (selection.eq(state.selection))
    return false;
  if (dispatch)
    dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
}
function arrow(axis, dir) {
  return (state, dispatch, view) => {
    if (!view)
      return false;
    const sel = state.selection;
    if (sel instanceof CellSelection) {
      return maybeSetSelection(
        state,
        dispatch,
        import_prosemirror_state4.Selection.near(sel.$headCell, dir)
      );
    }
    if (axis != "horiz" && !sel.empty)
      return false;
    const end = atEndOfCell(view, axis, dir);
    if (end == null)
      return false;
    if (axis == "horiz") {
      return maybeSetSelection(
        state,
        dispatch,
        import_prosemirror_state4.Selection.near(state.doc.resolve(sel.head + dir), dir)
      );
    } else {
      const $cell = state.doc.resolve(end);
      const $next = nextCell($cell, axis, dir);
      let newSel;
      if ($next)
        newSel = import_prosemirror_state4.Selection.near($next, 1);
      else if (dir < 0)
        newSel = import_prosemirror_state4.Selection.near(state.doc.resolve($cell.before(-1)), -1);
      else
        newSel = import_prosemirror_state4.Selection.near(state.doc.resolve($cell.after(-1)), 1);
      return maybeSetSelection(state, dispatch, newSel);
    }
  };
}
function shiftArrow(axis, dir) {
  return (state, dispatch, view) => {
    if (!view)
      return false;
    const sel = state.selection;
    let cellSel;
    if (sel instanceof CellSelection) {
      cellSel = sel;
    } else {
      const end = atEndOfCell(view, axis, dir);
      if (end == null)
        return false;
      cellSel = new CellSelection(state.doc.resolve(end));
    }
    const $head = nextCell(cellSel.$headCell, axis, dir);
    if (!$head)
      return false;
    return maybeSetSelection(
      state,
      dispatch,
      new CellSelection(cellSel.$anchorCell, $head)
    );
  };
}
function deleteCellSelection(state, dispatch) {
  const sel = state.selection;
  if (!(sel instanceof CellSelection))
    return false;
  if (dispatch) {
    const tr = state.tr;
    const baseContent = tableNodeTypes(state.schema).cell.createAndFill().content;
    sel.forEachCell((cell, pos) => {
      if (!cell.content.eq(baseContent))
        tr.replace(
          tr.mapping.map(pos + 1),
          tr.mapping.map(pos + cell.nodeSize - 1),
          new import_prosemirror_model3.Slice(baseContent, 0, 0)
        );
    });
    if (tr.docChanged)
      dispatch(tr);
  }
  return true;
}
function handleTripleClick(view, pos) {
  const doc = view.state.doc, $cell = cellAround(doc.resolve(pos));
  if (!$cell)
    return false;
  view.dispatch(view.state.tr.setSelection(new CellSelection($cell)));
  return true;
}
function handlePaste(view, _, slice) {
  if (!isInTable(view.state))
    return false;
  let cells = pastedCells(slice);
  const sel = view.state.selection;
  if (sel instanceof CellSelection) {
    if (!cells)
      cells = {
        width: 1,
        height: 1,
        rows: [
          import_prosemirror_model3.Fragment.from(
            fitSlice(tableNodeTypes(view.state.schema).cell, slice)
          )
        ]
      };
    const table = sel.$anchorCell.node(-1);
    const start = sel.$anchorCell.start(-1);
    const rect = TableMap.get(table).rectBetween(
      sel.$anchorCell.pos - start,
      sel.$headCell.pos - start
    );
    cells = clipCells(cells, rect.right - rect.left, rect.bottom - rect.top);
    insertCells(view.state, view.dispatch, start, rect, cells);
    return true;
  } else if (cells) {
    const $cell = selectionCell(view.state);
    const start = $cell.start(-1);
    insertCells(
      view.state,
      view.dispatch,
      start,
      TableMap.get($cell.node(-1)).findCell($cell.pos - start),
      cells
    );
    return true;
  } else {
    return false;
  }
}
function handleMouseDown(view, startEvent) {
  var _a;
  if (startEvent.ctrlKey || startEvent.metaKey)
    return;
  const startDOMCell = domInCell(view, startEvent.target);
  let $anchor;
  if (startEvent.shiftKey && view.state.selection instanceof CellSelection) {
    setCellSelection(view.state.selection.$anchorCell, startEvent);
    startEvent.preventDefault();
  } else if (startEvent.shiftKey && startDOMCell && ($anchor = cellAround(view.state.selection.$anchor)) != null && ((_a = cellUnderMouse(view, startEvent)) == null ? void 0 : _a.pos) != $anchor.pos) {
    setCellSelection($anchor, startEvent);
    startEvent.preventDefault();
  } else if (!startDOMCell) {
    return;
  }
  function setCellSelection($anchor2, event) {
    let $head = cellUnderMouse(view, event);
    const starting = tableEditingKey.getState(view.state) == null;
    if (!$head || !inSameTable($anchor2, $head)) {
      if (starting)
        $head = $anchor2;
      else
        return;
    }
    const selection = new CellSelection($anchor2, $head);
    if (starting || !view.state.selection.eq(selection)) {
      const tr = view.state.tr.setSelection(selection);
      if (starting)
        tr.setMeta(tableEditingKey, $anchor2.pos);
      view.dispatch(tr);
    }
  }
  function stop() {
    view.root.removeEventListener("mouseup", stop);
    view.root.removeEventListener("dragstart", stop);
    view.root.removeEventListener("mousemove", move);
    if (tableEditingKey.getState(view.state) != null)
      view.dispatch(view.state.tr.setMeta(tableEditingKey, -1));
  }
  function move(_event) {
    const event = _event;
    const anchor = tableEditingKey.getState(view.state);
    let $anchor2;
    if (anchor != null) {
      $anchor2 = view.state.doc.resolve(anchor);
    } else if (domInCell(view, event.target) != startDOMCell) {
      $anchor2 = cellUnderMouse(view, startEvent);
      if (!$anchor2)
        return stop();
    }
    if ($anchor2)
      setCellSelection($anchor2, event);
  }
  view.root.addEventListener("mouseup", stop);
  view.root.addEventListener("dragstart", stop);
  view.root.addEventListener("mousemove", move);
}
function atEndOfCell(view, axis, dir) {
  if (!(view.state.selection instanceof import_prosemirror_state4.TextSelection))
    return null;
  const { $head } = view.state.selection;
  for (let d = $head.depth - 1; d >= 0; d--) {
    const parent = $head.node(d), index = dir < 0 ? $head.index(d) : $head.indexAfter(d);
    if (index != (dir < 0 ? 0 : parent.childCount))
      return null;
    if (parent.type.spec.tableRole == "cell" || parent.type.spec.tableRole == "header_cell") {
      const cellPos = $head.before(d);
      const dirStr = axis == "vert" ? dir > 0 ? "down" : "up" : dir > 0 ? "right" : "left";
      return view.endOfTextblock(dirStr) ? cellPos : null;
    }
  }
  return null;
}
function domInCell(view, dom) {
  for (; dom && dom != view.dom; dom = dom.parentNode) {
    if (dom.nodeName == "TD" || dom.nodeName == "TH") {
      return dom;
    }
  }
  return null;
}
function cellUnderMouse(view, event) {
  const mousePos = view.posAtCoords({
    left: event.clientX,
    top: event.clientY
  });
  if (!mousePos)
    return null;
  return mousePos ? cellAround(view.state.doc.resolve(mousePos.pos)) : null;
}

// src/commands.ts
var import_prosemirror_model4 = require("prosemirror-model");
var import_prosemirror_state5 = require("prosemirror-state");
function selectedRect(state) {
  const sel = state.selection;
  const $pos = selectionCell(state);
  const table = $pos.node(-1);
  const tableStart = $pos.start(-1);
  const map = TableMap.get(table);
  const rect = sel instanceof CellSelection ? map.rectBetween(
    sel.$anchorCell.pos - tableStart,
    sel.$headCell.pos - tableStart
  ) : map.findCell($pos.pos - tableStart);
  return { ...rect, tableStart, map, table };
}
function addColumn(tr, { map, tableStart, table }, col) {
  let refColumn = col > 0 ? -1 : 0;
  if (columnIsHeader(map, table, col + refColumn)) {
    refColumn = col == 0 || col == map.width ? null : 0;
  }
  for (let row = 0; row < map.height; row++) {
    const index = row * map.width + col;
    const type = refColumn == null ? tableNodeTypes(table.type.schema).cell : table.nodeAt(map.map[index + refColumn]).type;
    const pos = map.positionAt(row, col, table);
    tr.insert(tr.mapping.map(tableStart + pos), type.createAndFill());
  }
  return tr;
}
function addColumnBefore(state, dispatch) {
  if (!isInTable(state))
    return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addColumn(state.tr, rect, rect.left));
  }
  return true;
}
function addColumnAfter(state, dispatch) {
  if (!isInTable(state))
    return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addColumn(state.tr, rect, rect.right));
  }
  return true;
}
function removeColumn(tr, { map, table, tableStart }, col) {
  const mapStart = tr.mapping.maps.length;
  for (let row = 0; row < map.height; row++) {
    const index = row * map.width + col;
    const pos = map.map[index];
    const cell = table.nodeAt(pos);
    const start = tr.mapping.slice(mapStart).map(tableStart + pos);
    tr.delete(start, start + cell.nodeSize);
  }
}
function deleteColumn(state, dispatch) {
  if (!isInTable(state))
    return false;
  if (dispatch) {
    const rect = selectedRect(state);
    const tr = state.tr;
    if (rect.left == 0 && rect.right == rect.map.width)
      return false;
    for (let i = rect.right - 1; ; i--) {
      removeColumn(tr, rect, i);
      if (i == rect.left)
        break;
      const table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc;
      if (!table) {
        throw RangeError("No table found");
      }
      rect.table = table;
      rect.map = TableMap.get(table);
    }
    dispatch(tr);
  }
  return true;
}
function rowIsHeader(map, table, row) {
  var _a;
  const headerCell = tableNodeTypes(table.type.schema).header_cell;
  for (let col = 0; col < map.width; col++)
    if (((_a = table.nodeAt(map.map[col + row * map.width])) == null ? void 0 : _a.type) != headerCell)
      return false;
  return true;
}
function addRow(tr, { map, tableStart, table }, row) {
  var _a;
  let rowPos = tableStart;
  for (let i = 0; i < row; i++)
    rowPos += table.child(i).nodeSize;
  const cells = [];
  let refRow = row > 0 ? -1 : 0;
  if (rowIsHeader(map, table, row + refRow))
    refRow = row == 0 || row == map.height ? null : 0;
  for (let col = 0, index = map.width * row; col < map.width; col++, index++) {
    const type = refRow == null ? tableNodeTypes(table.type.schema).cell : (_a = table.nodeAt(map.map[index + refRow * map.width])) == null ? void 0 : _a.type;
    const node = type == null ? void 0 : type.createAndFill();
    if (node)
      cells.push(node);
  }
  tr.insert(rowPos, tableNodeTypes(table.type.schema).row.create(null, cells));
  return tr;
}
function addRowBefore(state, dispatch) {
  if (!isInTable(state))
    return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addRow(state.tr, rect, rect.top));
  }
  return true;
}
function addRowAfter(state, dispatch) {
  if (!isInTable(state))
    return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addRow(state.tr, rect, rect.bottom));
  }
  return true;
}
function removeRow(tr, { table, tableStart }, row) {
  let rowPos = 0;
  for (let i = 0; i < row; i++) {
    rowPos += table.child(i).nodeSize;
  }
  const nextRow = rowPos + table.child(row).nodeSize;
  tr.delete(rowPos + tableStart, nextRow + tableStart);
}
function deleteRow(state, dispatch) {
  if (!isInTable(state))
    return false;
  if (dispatch) {
    const rect = selectedRect(state), tr = state.tr;
    if (rect.top == 0 && rect.bottom == rect.map.height)
      return false;
    for (let i = rect.bottom - 1; ; i--) {
      removeRow(tr, rect, i);
      if (i == rect.top)
        break;
      const table = rect.tableStart ? tr.doc.nodeAt(rect.tableStart - 1) : tr.doc;
      if (!table) {
        throw RangeError("No table found");
      }
      rect.table = table;
      rect.map = TableMap.get(rect.table);
    }
    dispatch(tr);
  }
  return true;
}
function mergeCells(state, dispatch) {
  const sel = state.selection;
  if (!(sel instanceof CellSelection) || sel.$anchorCell.pos === sel.$headCell.pos) {
    return false;
  }
  if (dispatch) {
    const rect = selectedRect(state);
    const tr = state.tr;
    let content = import_prosemirror_model4.Fragment.empty;
    let firstCellPos;
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const cellPos = rect.map.map[row * rect.map.width + col];
        const cell = rect.table.nodeAt(cellPos);
        if (!cell)
          continue;
        if (firstCellPos === void 0) {
          firstCellPos = cellPos;
        } else {
          content = content.append(cell.content);
          tr.delete(
            cellPos + rect.tableStart,
            cellPos + rect.tableStart + cell.nodeSize
          );
        }
      }
    }
    if (firstCellPos !== void 0) {
      tr.replaceWith(
        firstCellPos + rect.tableStart,
        firstCellPos + rect.tableStart + 1,
        content
      );
      tr.setSelection(
        new CellSelection(tr.doc.resolve(firstCellPos + rect.tableStart))
      );
    }
    dispatch(tr);
  }
  return true;
}
function setCellAttr(name, value) {
  return function(state, dispatch) {
    if (!isInTable(state))
      return false;
    const $cell = selectionCell(state);
    if ($cell.nodeAfter.attrs[name] === value)
      return false;
    if (dispatch) {
      const tr = state.tr;
      if (state.selection instanceof CellSelection)
        state.selection.forEachCell((node, pos) => {
          if (node.attrs[name] !== value)
            tr.setNodeMarkup(pos, null, {
              ...node.attrs,
              [name]: value
            });
        });
      else
        tr.setNodeMarkup($cell.pos, null, {
          ...$cell.nodeAfter.attrs,
          [name]: value
        });
      dispatch(tr);
    }
    return true;
  };
}
function deprecated_toggleHeader(type) {
  return function(state, dispatch) {
    if (!isInTable(state))
      return false;
    if (dispatch) {
      const types = tableNodeTypes(state.schema);
      const rect = selectedRect(state), tr = state.tr;
      const cells = rect.map.cellsInRect(
        type == "column" ? {
          left: rect.left,
          top: 0,
          right: rect.right,
          bottom: rect.map.height
        } : type == "row" ? {
          left: 0,
          top: rect.top,
          right: rect.map.width,
          bottom: rect.bottom
        } : rect
      );
      const nodes = cells.map((pos) => rect.table.nodeAt(pos));
      for (let i = 0; i < cells.length; i++)
        if (nodes[i].type == types.header_cell)
          tr.setNodeMarkup(
            rect.tableStart + cells[i],
            types.cell,
            nodes[i].attrs
          );
      if (tr.steps.length == 0)
        for (let i = 0; i < cells.length; i++)
          tr.setNodeMarkup(
            rect.tableStart + cells[i],
            types.header_cell,
            nodes[i].attrs
          );
      dispatch(tr);
    }
    return true;
  };
}
function isHeaderEnabledByType(type, rect, types) {
  const cellPositions = rect.map.cellsInRect({
    left: 0,
    top: 0,
    right: type == "row" ? rect.map.width : 1,
    bottom: type == "column" ? rect.map.height : 1
  });
  for (let i = 0; i < cellPositions.length; i++) {
    const cell = rect.table.nodeAt(cellPositions[i]);
    if (cell && cell.type !== types.header_cell) {
      return false;
    }
  }
  return true;
}
function toggleHeader(type, options) {
  options = options || { useDeprecatedLogic: false };
  if (options.useDeprecatedLogic)
    return deprecated_toggleHeader(type);
  return function(state, dispatch) {
    if (!isInTable(state))
      return false;
    if (dispatch) {
      const types = tableNodeTypes(state.schema);
      const rect = selectedRect(state), tr = state.tr;
      const isHeaderRowEnabled = isHeaderEnabledByType("row", rect, types);
      const isHeaderColumnEnabled = isHeaderEnabledByType(
        "column",
        rect,
        types
      );
      const isHeaderEnabled = type === "column" ? isHeaderRowEnabled : type === "row" ? isHeaderColumnEnabled : false;
      const selectionStartsAt = isHeaderEnabled ? 1 : 0;
      const cellsRect = type == "column" ? {
        left: 0,
        top: selectionStartsAt,
        right: 1,
        bottom: rect.map.height
      } : type == "row" ? {
        left: selectionStartsAt,
        top: 0,
        right: rect.map.width,
        bottom: 1
      } : rect;
      const newType = type == "column" ? isHeaderColumnEnabled ? types.cell : types.header_cell : type == "row" ? isHeaderRowEnabled ? types.cell : types.header_cell : types.cell;
      rect.map.cellsInRect(cellsRect).forEach((relativeCellPos) => {
        const cellPos = relativeCellPos + rect.tableStart;
        const cell = tr.doc.nodeAt(cellPos);
        if (cell) {
          tr.setNodeMarkup(cellPos, newType, cell.attrs);
        }
      });
      dispatch(tr);
    }
    return true;
  };
}
var toggleHeaderRow = toggleHeader("row", {
  useDeprecatedLogic: true
});
var toggleHeaderColumn = toggleHeader("column", {
  useDeprecatedLogic: true
});
var toggleHeaderCell = toggleHeader("cell", {
  useDeprecatedLogic: true
});
function findNextCell($cell, dir) {
  if (dir < 0) {
    const before = $cell.nodeBefore;
    if (before)
      return $cell.pos - before.nodeSize;
    for (let row = $cell.index(-1) - 1, rowEnd = $cell.before(); row >= 0; row--) {
      const rowNode = $cell.node(-1).child(row);
      const lastChild = rowNode.lastChild;
      if (lastChild) {
        return rowEnd - 1 - lastChild.nodeSize;
      }
      rowEnd -= rowNode.nodeSize;
    }
  } else {
    if ($cell.index() < $cell.parent.childCount - 1) {
      return $cell.pos + $cell.nodeAfter.nodeSize;
    }
    const table = $cell.node(-1);
    for (let row = $cell.indexAfter(-1), rowStart = $cell.after(); row < table.childCount; row++) {
      const rowNode = table.child(row);
      if (rowNode.childCount)
        return rowStart + 1;
      rowStart += rowNode.nodeSize;
    }
  }
  return null;
}
function goToNextCell(direction) {
  return function(state, dispatch) {
    if (!isInTable(state))
      return false;
    const cell = findNextCell(selectionCell(state), direction);
    if (cell == null)
      return false;
    if (dispatch) {
      const $cell = state.doc.resolve(cell);
      dispatch(
        state.tr.setSelection(import_prosemirror_state5.TextSelection.between($cell, moveCellForward($cell))).scrollIntoView()
      );
    }
    return true;
  };
}
function deleteTable(state, dispatch) {
  const $pos = state.selection.$anchor;
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.spec.tableRole == "table") {
      if (dispatch)
        dispatch(
          state.tr.delete($pos.before(d), $pos.after(d)).scrollIntoView()
        );
      return true;
    }
  }
  return false;
}

// src/index.ts
function tableEditing({
  allowTableNodeSelection = false
} = {}) {
  return new import_prosemirror_state6.Plugin({
    key: tableEditingKey,
    // This piece of state is used to remember when a mouse-drag
    // cell-selection is happening, so that it can continue even as
    // transactions (which might move its anchor cell) come in.
    state: {
      init() {
        return null;
      },
      apply(tr, cur) {
        const set = tr.getMeta(tableEditingKey);
        if (set != null)
          return set == -1 ? null : set;
        if (cur == null || !tr.docChanged)
          return cur;
        const { deleted, pos } = tr.mapping.mapResult(cur);
        return deleted ? null : pos;
      }
    },
    props: {
      decorations: drawCellSelection,
      handleDOMEvents: {
        mousedown: handleMouseDown
      },
      createSelectionBetween(view) {
        return tableEditingKey.getState(view.state) != null ? view.state.selection : null;
      },
      handleTripleClick,
      handleKeyDown,
      handlePaste
    },
    appendTransaction(_, oldState, state) {
      return normalizeSelection(
        state,
        fixTables(state, oldState),
        allowTableNodeSelection
      );
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CellBookmark,
  CellSelection,
  TableMap,
  __clipCells,
  __insertCells,
  __pastedCells,
  addColumn,
  addColumnAfter,
  addColumnBefore,
  addRow,
  addRowAfter,
  addRowBefore,
  cellAround,
  colCount,
  columnIsHeader,
  deleteColumn,
  deleteRow,
  deleteTable,
  findCell,
  fixTables,
  fixTablesKey,
  goToNextCell,
  handlePaste,
  inSameTable,
  isInTable,
  mergeCells,
  moveCellForward,
  nextCell,
  pointsAtCell,
  removeColumn,
  removeRow,
  rowIsHeader,
  selectedRect,
  selectionCell,
  setCellAttr,
  tableEditing,
  tableEditingKey,
  tableNodeTypes,
  toggleHeader,
  toggleHeaderCell,
  toggleHeaderColumn,
  toggleHeaderRow
});
