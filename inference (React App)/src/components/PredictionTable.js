import React from "react";

const PredictionTable = React.memo(function PredictionTable({
  timeline,
  timeLabels,
  cellWidth,
  labelOffset,
  firstCellRef,
  labelCellRef,
}) {
  return (
    <table
      style={{
        borderCollapse: "collapse",
        tableLayout: "fixed",
        width: `${labelOffset + timeLabels.length * cellWidth}px`
      }}
    >
      <colgroup>
        <col style={{ width: `120px` }} /> {}
        {timeLabels.map((_, i) => (
          <col key={i} style={{ width: `${cellWidth}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            ref={labelCellRef}
            style={{
              position: "sticky",
              left: 0,
              background: "#fff",
              textAlign: "left"
            }}
          ></th>
          {timeLabels.map((t, i) => (
            <th
              key={i}
              style={{
                width: `${cellWidth}px`,
                minWidth: `${cellWidth}px`,
                maxWidth: `${cellWidth}px`,
                padding: "4px",
                fontSize: "0.75rem",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(() => {
          // Swapping bass and strings
          const swapped = [...timeline];
          [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
          const instruments = ["Piano", "Guitar", "Strings", "Bass", "Drums"];

          return swapped.map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: "#f7f7f7",
                  paddingRight: "1rem",
                  paddingLeft: "0",
                  fontWeight: "bold",
                  textAlign: "left",
                  fontSize: "1.5rem",
                }}
              >
                {instruments[rowIdx]}
              </td>
              {row.map((isActive, colIdx) => (
                <td
                  key={colIdx}
                  ref={rowIdx === 0 && colIdx === 0 ? firstCellRef : null}
                  style={{
                    width: `${cellWidth}px`,
                    height: "40px",
                    backgroundColor: isActive ? "#4caf50" : "#e0e0e0",
                    border: "1px solid #ccc",
                  }}
                />
              ))}
            </tr>
          ));
        })()}
      </tbody>
    </table>
  );
});

export default PredictionTable;
