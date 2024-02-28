// This file defines a number of table-related commands.

import { Fragment, Node, NodeType, ResolvedPos } from 'prosemirror-model';
import {
  Command,
  EditorState,
  TextSelection,
  Transaction,
} from 'prosemirror-state';

import { CellSelection } from './cellselection';
import type { Direction } from './input';
import { tableNodeTypes } from './schema';
import { Rect, TableMap } from './tablemap';
import {
  columnIsHeader,
  isInTable,
  moveCellForward,
  selectionCell,
} from './util';

/**
 * @public
 */
export type TableRect = Rect & {
  tableStart: number;
  map: TableMap;
  table: Node;
};

/**
 * Helper to get the selected rectangle in a table, if any. Adds table
 * map, table node, and table start offset to the object for
 * convenience.
 *
 * @public
 */
export function selectedRect(state: EditorState): TableRect {
  const sel = state.selection;
  const $pos = selectionCell(state);
  const table = $pos.node(-1);
  const tableStart = $pos.start(-1);
  const map = TableMap.get(table);
  const rect =
    sel instanceof CellSelection
      ? map.rectBetween(
          sel.$anchorCell.pos - tableStart,
          sel.$headCell.pos - tableStart,
        )
      : map.findCell($pos.pos - tableStart);
  return { ...rect, tableStart, map, table };
}

/**
 * Add a column at the given position in a table.
 *
 * @public
 */
export function addColumn(
  tr: Transaction,
  { map, tableStart, table }: TableRect,
  col: number,
): Transaction {
  let refColumn: number | null = col > 0 ? -1 : 0;
  if (columnIsHeader(map, table, col + refColumn)) {
    refColumn = col == 0 || col == map.width ? null : 0;
  }

  for (let row = 0; row < map.height; row++) {
    const index = row * map.width + col;

    const type =
      refColumn == null
        ? tableNodeTypes(table.type.schema).cell
        : table.nodeAt(map.map[index + refColumn])!.type;
    const pos = map.positionAt(row, col, table);
    tr.insert(tr.mapping.map(tableStart + pos), type.createAndFill()!);
  }
  return tr;
}

/**
 * Command to add a column before the column with the selection.
 *
 * @public
 */
export function addColumnBefore(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addColumn(state.tr, rect, rect.left));
  }
  return true;
}

/**
 * Command to add a column after the column with the selection.
 *
 * @public
 */
export function addColumnAfter(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addColumn(state.tr, rect, rect.right));
  }
  return true;
}

/**
 * @public
 */
export function removeColumn(
  tr: Transaction,
  { map, table, tableStart }: TableRect,
  col: number,
) {
  const mapStart = tr.mapping.maps.length;

  for (let row = 0; row < map.height; row++) {
    const index = row * map.width + col;
    const pos = map.map[index];
    const cell = table.nodeAt(pos)!;
    const start = tr.mapping.slice(mapStart).map(tableStart + pos);

    tr.delete(start, start + cell.nodeSize);
  }
}

/**
 * Command function that removes the selected columns from a table.
 *
 * @public
 */
export function deleteColumn(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    const tr = state.tr;
    if (rect.left == 0 && rect.right == rect.map.width) return false;
    for (let i = rect.right - 1; ; i--) {
      removeColumn(tr, rect, i);
      if (i == rect.left) break;

      const table = rect.tableStart
        ? tr.doc.nodeAt(rect.tableStart - 1)
        : tr.doc;
      if (!table) {
        throw RangeError('No table found');
      }
      rect.table = table;
      rect.map = TableMap.get(table);
    }
    dispatch(tr);
  }
  return true;
}

/**
 * @public
 */
export function rowIsHeader(map: TableMap, table: Node, row: number): boolean {
  const headerCell = tableNodeTypes(table.type.schema).header_cell;
  for (let col = 0; col < map.width; col++)
    if (table.nodeAt(map.map[col + row * map.width])?.type != headerCell)
      return false;
  return true;
}

/**
 * @public
 */
export function addRow(
  tr: Transaction,
  { map, tableStart, table }: TableRect,
  row: number,
): Transaction {
  let rowPos = tableStart;
  for (let i = 0; i < row; i++) rowPos += table.child(i).nodeSize;
  const cells = [];
  let refRow: number | null = row > 0 ? -1 : 0;
  if (rowIsHeader(map, table, row + refRow))
    refRow = row == 0 || row == map.height ? null : 0;
  for (let col = 0, index = map.width * row; col < map.width; col++, index++) {
    const type =
      refRow == null
        ? tableNodeTypes(table.type.schema).cell
        : table.nodeAt(map.map[index + refRow * map.width])?.type;
    const node = type?.createAndFill();
    if (node) cells.push(node);
  }
  tr.insert(rowPos, tableNodeTypes(table.type.schema).row.create(null, cells));
  return tr;
}

/**
 * Add a table row before the selection.
 *
 * @public
 */
export function addRowBefore(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addRow(state.tr, rect, rect.top));
  }
  return true;
}

/**
 * Add a table row after the selection.
 *
 * @public
 */
export function addRowAfter(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    dispatch(addRow(state.tr, rect, rect.bottom));
  }
  return true;
}

/**
 * @public
 */
export function removeRow(
  tr: Transaction,
  { table, tableStart }: TableRect,
  row: number,
): void {
  let rowPos = 0;
  for (let i = 0; i < row; i++) {
    rowPos += table.child(i).nodeSize;
  }
  const nextRow = rowPos + table.child(row).nodeSize;

  // 단순히 해당 행을 삭제합니다.
  tr.delete(rowPos + tableStart, nextRow + tableStart);
}

/**
 * Remove the selected rows from a table.
 *
 * @public
 */
export function deleteRow(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state),
      tr = state.tr;
    if (rect.top == 0 && rect.bottom == rect.map.height) return false;
    for (let i = rect.bottom - 1; ; i--) {
      removeRow(tr, rect, i);
      if (i == rect.top) break;
      const table = rect.tableStart
        ? tr.doc.nodeAt(rect.tableStart - 1)
        : tr.doc;
      if (!table) {
        throw RangeError('No table found');
      }
      rect.table = table;
      rect.map = TableMap.get(rect.table);
    }
    dispatch(tr);
  }
  return true;
}

function isEmpty(cell: Node): boolean {
  const c = cell.content;

  return (
    c.childCount == 1 && c.child(0).isTextblock && c.child(0).childCount == 0
  );
}

function cellsOverlapRectangle({ width, height, map }: TableMap, rect: Rect) {
  let indexTop = rect.top * width + rect.left,
    indexLeft = indexTop;
  let indexBottom = (rect.bottom - 1) * width + rect.left,
    indexRight = indexTop + (rect.right - rect.left - 1);
  for (let i = rect.top; i < rect.bottom; i++) {
    if (
      (rect.left > 0 && map[indexLeft] == map[indexLeft - 1]) ||
      (rect.right < width && map[indexRight] == map[indexRight + 1])
    )
      return true;
    indexLeft += width;
    indexRight += width;
  }
  for (let i = rect.left; i < rect.right; i++) {
    if (
      (rect.top > 0 && map[indexTop] == map[indexTop - width]) ||
      (rect.bottom < height && map[indexBottom] == map[indexBottom + width])
    )
      return true;
    indexTop++;
    indexBottom++;
  }
  return false;
}

/**
 * Merge the selected cells into a single cell. Only available when
 * the selected cells' outline forms a rectangle.
 *
 * @public
 */
export function mergeCells(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const sel = state.selection;
  // 셀 선택 확인
  if (
    !(sel instanceof CellSelection) ||
    sel.$anchorCell.pos === sel.$headCell.pos
  ) {
    return false;
  }

  if (dispatch) {
    const rect = selectedRect(state);
    const tr = state.tr;
    let content = Fragment.empty;
    let firstCellPos: number | undefined;

    // 선택된 모든 셀의 내용을 모읍니다.
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let col = rect.left; col < rect.right; col++) {
        const cellPos = rect.map.map[row * rect.map.width + col];
        const cell = rect.table.nodeAt(cellPos);
        if (!cell) continue;

        if (firstCellPos === undefined) {
          firstCellPos = cellPos; // 첫 번째 셀 위치 저장
        } else {
          content = content.append(cell.content); // 내용 추가
          tr.delete(
            cellPos + rect.tableStart,
            cellPos + rect.tableStart + cell.nodeSize,
          ); // 나머지 셀 삭제
        }
      }
    }

    // 첫 번째 셀에 모든 내용을 삽입합니다.
    if (firstCellPos !== undefined) {
      tr.replaceWith(
        firstCellPos + rect.tableStart,
        firstCellPos + rect.tableStart + 1,
        content,
      );
      tr.setSelection(
        new CellSelection(tr.doc.resolve(firstCellPos + rect.tableStart)),
      );
    }

    dispatch(tr);
  }
  return true;
}

/**
 * @public
 */
export interface GetCellTypeOptions {
  node: Node;
  row: number;
  col: number;
}

/**
 * Returns a command that sets the given attribute to the given value,
 * and is only available when the currently selected cell doesn't
 * already have that attribute set to that value.
 *
 * @public
 */
export function setCellAttr(name: string, value: unknown): Command {
  return function (state, dispatch) {
    if (!isInTable(state)) return false;
    const $cell = selectionCell(state);
    if ($cell.nodeAfter!.attrs[name] === value) return false;
    if (dispatch) {
      const tr = state.tr;
      if (state.selection instanceof CellSelection)
        state.selection.forEachCell((node, pos) => {
          if (node.attrs[name] !== value)
            tr.setNodeMarkup(pos, null, {
              ...node.attrs,
              [name]: value,
            });
        });
      else
        tr.setNodeMarkup($cell.pos, null, {
          ...$cell.nodeAfter!.attrs,
          [name]: value,
        });
      dispatch(tr);
    }
    return true;
  };
}

function deprecated_toggleHeader(type: ToggleHeaderType): Command {
  return function (state, dispatch) {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const types = tableNodeTypes(state.schema);
      const rect = selectedRect(state),
        tr = state.tr;
      const cells = rect.map.cellsInRect(
        type == 'column'
          ? {
              left: rect.left,
              top: 0,
              right: rect.right,
              bottom: rect.map.height,
            }
          : type == 'row'
          ? {
              left: 0,
              top: rect.top,
              right: rect.map.width,
              bottom: rect.bottom,
            }
          : rect,
      );
      const nodes = cells.map((pos) => rect.table.nodeAt(pos)!);
      for (
        let i = 0;
        i < cells.length;
        i++ // Remove headers, if any
      )
        if (nodes[i].type == types.header_cell)
          tr.setNodeMarkup(
            rect.tableStart + cells[i],
            types.cell,
            nodes[i].attrs,
          );
      if (tr.steps.length == 0)
        for (
          let i = 0;
          i < cells.length;
          i++ // No headers removed, add instead
        )
          tr.setNodeMarkup(
            rect.tableStart + cells[i],
            types.header_cell,
            nodes[i].attrs,
          );
      dispatch(tr);
    }
    return true;
  };
}

function isHeaderEnabledByType(
  type: 'row' | 'column',
  rect: TableRect,
  types: Record<string, NodeType>,
): boolean {
  // Get cell positions for first row or first column
  const cellPositions = rect.map.cellsInRect({
    left: 0,
    top: 0,
    right: type == 'row' ? rect.map.width : 1,
    bottom: type == 'column' ? rect.map.height : 1,
  });

  for (let i = 0; i < cellPositions.length; i++) {
    const cell = rect.table.nodeAt(cellPositions[i]);
    if (cell && cell.type !== types.header_cell) {
      return false;
    }
  }

  return true;
}

/**
 * @public
 */
export type ToggleHeaderType = 'column' | 'row' | 'cell';

/**
 * Toggles between row/column header and normal cells (Only applies to first row/column).
 * For deprecated behavior pass `useDeprecatedLogic` in options with true.
 *
 * @public
 */
export function toggleHeader(
  type: ToggleHeaderType,
  options?: { useDeprecatedLogic: boolean } | undefined,
): Command {
  options = options || { useDeprecatedLogic: false };

  if (options.useDeprecatedLogic) return deprecated_toggleHeader(type);
  return function (state, dispatch) {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const types = tableNodeTypes(state.schema);
      const rect = selectedRect(state),
        tr = state.tr;

      const isHeaderRowEnabled = isHeaderEnabledByType('row', rect, types);
      const isHeaderColumnEnabled = isHeaderEnabledByType(
        'column',
        rect,
        types,
      );

      const isHeaderEnabled =
        type === 'column'
          ? isHeaderRowEnabled
          : type === 'row'
          ? isHeaderColumnEnabled
          : false;

      const selectionStartsAt = isHeaderEnabled ? 1 : 0;

      const cellsRect =
        type == 'column'
          ? {
              left: 0,
              top: selectionStartsAt,
              right: 1,
              bottom: rect.map.height,
            }
          : type == 'row'
          ? {
              left: selectionStartsAt,
              top: 0,
              right: rect.map.width,
              bottom: 1,
            }
          : rect;

      const newType =
        type == 'column'
          ? isHeaderColumnEnabled
            ? types.cell
            : types.header_cell
          : type == 'row'
          ? isHeaderRowEnabled
            ? types.cell
            : types.header_cell
          : types.cell;

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

/**
 * Toggles whether the selected row contains header cells.
 *
 * @public
 */
export const toggleHeaderRow: Command = toggleHeader('row', {
  useDeprecatedLogic: true,
});
/**
 * Toggles whether the selected column contains header cells.
 *
 * @public
 */
export const toggleHeaderColumn: Command = toggleHeader('column', {
  useDeprecatedLogic: true,
});
/**
 * Toggles whether the selected cells are header cells.
 *
 * @public
 */
export const toggleHeaderCell: Command = toggleHeader('cell', {
  useDeprecatedLogic: true,
});

function findNextCell($cell: ResolvedPos, dir: Direction): number | null {
  if (dir < 0) {
    const before = $cell.nodeBefore;
    if (before) return $cell.pos - before.nodeSize;
    for (
      let row = $cell.index(-1) - 1, rowEnd = $cell.before();
      row >= 0;
      row--
    ) {
      const rowNode = $cell.node(-1).child(row);
      const lastChild = rowNode.lastChild;
      if (lastChild) {
        return rowEnd - 1 - lastChild.nodeSize;
      }
      rowEnd -= rowNode.nodeSize;
    }
  } else {
    if ($cell.index() < $cell.parent.childCount - 1) {
      return $cell.pos + $cell.nodeAfter!.nodeSize;
    }
    const table = $cell.node(-1);
    for (
      let row = $cell.indexAfter(-1), rowStart = $cell.after();
      row < table.childCount;
      row++
    ) {
      const rowNode = table.child(row);
      if (rowNode.childCount) return rowStart + 1;
      rowStart += rowNode.nodeSize;
    }
  }
  return null;
}

/**
 * Returns a command for selecting the next (direction=1) or previous
 * (direction=-1) cell in a table.
 *
 * @public
 */
export function goToNextCell(direction: Direction): Command {
  return function (state, dispatch) {
    if (!isInTable(state)) return false;
    const cell = findNextCell(selectionCell(state), direction);
    if (cell == null) return false;
    if (dispatch) {
      const $cell = state.doc.resolve(cell);
      dispatch(
        state.tr
          .setSelection(TextSelection.between($cell, moveCellForward($cell)))
          .scrollIntoView(),
      );
    }
    return true;
  };
}

/**
 * Deletes the table around the selection, if any.
 *
 * @public
 */
export function deleteTable(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const $pos = state.selection.$anchor;
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.spec.tableRole == 'table') {
      if (dispatch)
        dispatch(
          state.tr.delete($pos.before(d), $pos.after(d)).scrollIntoView(),
        );
      return true;
    }
  }
  return false;
}
