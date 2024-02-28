// Utilities used for copy/paste handling.
//
// This module handles pasting cell content into tables, or pasting
// anything into a cell selection, as replacing a block of cells with
// the content of the selection. When pasting cells into a cell, that
// involves placing the block of pasted content so that its top left
// aligns with the selection cell, optionally extending the table to
// the right or bottom to make sure it is large enough. Pasting into a
// cell selection is different, here the cells in the selection are
// clipped to the selection's rectangle, optionally repeating the
// pasted cells when they are smaller than the selection.

import { Fragment, Node, NodeType, Schema, Slice } from 'prosemirror-model';
import { Transform } from 'prosemirror-transform';

import { EditorState, Transaction } from 'prosemirror-state';
import { CellSelection } from './cellselection';
import { tableNodeTypes } from './schema';
import { Rect, TableMap } from './tablemap';

/**
 * @internal
 */
export type Area = { width: number; height: number; rows: Fragment[] };

// Utilities to help with copying and pasting table cells

/**
 * Get a rectangular area of cells from a slice, or null if the outer
 * nodes of the slice aren't table cells or rows.
 *
 * @internal
 */
export function pastedCells(slice: Slice): Area | null {
  if (!slice.size) return null;
  let { content, openStart, openEnd } = slice;
  while (
    content.childCount == 1 &&
    ((openStart > 0 && openEnd > 0) ||
      content.child(0).type.spec.tableRole == 'table')
  ) {
    openStart--;
    openEnd--;
    content = content.child(0).content;
  }
  const first = content.child(0);
  const role = first.type.spec.tableRole;
  const schema = first.type.schema,
    rows = [];
  if (role == 'row') {
    for (let i = 0; i < content.childCount; i++) {
      let cells = content.child(i).content;
      const left = i ? 0 : Math.max(0, openStart - 1);
      const right = i < content.childCount - 1 ? 0 : Math.max(0, openEnd - 1);
      if (left || right)
        cells = fitSlice(
          tableNodeTypes(schema).row,
          new Slice(cells, left, right),
        ).content;
      rows.push(cells);
    }
  } else if (role == 'cell' || role == 'header_cell') {
    rows.push(
      openStart || openEnd
        ? fitSlice(
            tableNodeTypes(schema).row,
            new Slice(content, openStart, openEnd),
          ).content
        : content,
    );
  } else {
    return null;
  }
  return ensureRectangular(schema, rows);
}

function ensureRectangular(schema: Schema, rows: Fragment[]): Area {
  let maxWidth = 0;
  rows.forEach((row) => {
    maxWidth = Math.max(maxWidth, row.childCount);
  });

  rows.forEach((row, rowIndex) => {
    const shortfall = maxWidth - row.childCount;
    if (shortfall > 0) {
      const emptyCells = Array.from(
        { length: shortfall },
        () => tableNodeTypes(schema).cell.createAndFill()!,
      );
      rows[rowIndex] = row.append(Fragment.from(emptyCells));
    }
  });

  return { height: rows.length, width: maxWidth, rows };
}

export function fitSlice(nodeType: NodeType, slice: Slice): Node {
  const node = nodeType.createAndFill()!;
  const tr = new Transform(node).replace(0, node.content.size, slice);
  return tr.doc;
}

export function clipCells(
  { width, height, rows }: Area,
  newWidth: number,
  newHeight: number,
): Area {
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

    newRows.push(Fragment.from(newRow));
  }

  return {
    width: newWidth,
    height: newHeight,
    rows: newRows,
  };
}

// Make sure a table has at least the given width and height. Return
// true if something was changed.
function growTable(
  tr: Transaction,
  map: TableMap,
  table: Node,
  start: number,
  width: number,
  height: number,
  mapFrom: number,
): boolean {
  const schema = tr.doc.type.schema;
  const types = tableNodeTypes(schema);
  let empty;
  let emptyHead;
  if (width > map.width) {
    for (let row = 0, rowEnd = 0; row < map.height; row++) {
      const rowNode = table.child(row);
      rowEnd += rowNode.nodeSize;
      const cells: Node[] = [];
      let add: Node;
      if (rowNode.lastChild == null || rowNode.lastChild.type == types.cell)
        add = empty || (empty = types.cell.createAndFill()!);
      else add = emptyHead || (emptyHead = types.header_cell.createAndFill()!);
      for (let i = map.width; i < width; i++) cells.push(add);
      tr.insert(tr.mapping.slice(mapFrom).map(rowEnd - 1 + start), cells);
    }
  }
  if (height > map.height) {
    const cells = [];
    for (
      let i = 0, start = (map.height - 1) * map.width;
      i < Math.max(map.width, width);
      i++
    ) {
      const header =
        i >= map.width
          ? false
          : table.nodeAt(map.map[start + i])!.type == types.header_cell;
      cells.push(
        header
          ? emptyHead || (emptyHead = types.header_cell.createAndFill()!)
          : empty || (empty = types.cell.createAndFill()!),
      );
    }

    const emptyRow = types.row.create(null, Fragment.from(cells)),
      rows = [];
    for (let i = map.height; i < height; i++) rows.push(emptyRow);
    tr.insert(tr.mapping.slice(mapFrom).map(start + table.nodeSize - 2), rows);
  }
  return !!(empty || emptyHead);
}

/**
 * Insert the given set of cells (as returned by `pastedCells`) into a
 * table, at the position pointed at by rect.
 *
 * @internal
 */
export function insertCells(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  tableStart: number,
  rect: Rect,
  cells: Area,
): void {
  let table = tableStart ? state.doc.nodeAt(tableStart - 1) : state.doc;
  if (!table) {
    throw new Error('No table found');
  }
  let map = TableMap.get(table);
  const { top, left } = rect;
  const right = left + cells.width,
    bottom = top + cells.height;
  const tr = state.tr;
  let mapFrom = 0;

  function recomp(): void {
    table = tableStart ? tr.doc.nodeAt(tableStart - 1) : tr.doc;
    if (!table) {
      throw new Error('No table found');
    }
    map = TableMap.get(table);
    mapFrom = tr.mapping.maps.length;
  }

  // Prepare the table to be large enough and not have any cells
  // crossing the boundaries of the rectangle that we want to
  // insert into. If anything about it changes, recompute the table
  // map so that subsequent operations can see the current shape.
  if (growTable(tr, map, table, tableStart, right, bottom, mapFrom)) recomp();

  for (let row = top; row < bottom; row++) {
    const from = map.positionAt(row, left, table),
      to = map.positionAt(row, right, table);
    tr.replace(
      tr.mapping.slice(mapFrom).map(from + tableStart),
      tr.mapping.slice(mapFrom).map(to + tableStart),
      new Slice(cells.rows[row - top], 0, 0),
    );
  }
  recomp();
  tr.setSelection(
    new CellSelection(
      tr.doc.resolve(tableStart + map.positionAt(top, left, table)),
      tr.doc.resolve(tableStart + map.positionAt(bottom - 1, right - 1, table)),
    ),
  );
  dispatch(tr);
}
