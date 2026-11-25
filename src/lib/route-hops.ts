type SilentHops = { first: number; last: number };

// Only interpret explicit timeouts, or the archive's all-en-dash convention.
// Missing ASN, missing probes, and masked addresses can still describe a reply.
function noReply(cells: string[]) {
  const marker =
    /^(?:\*(?:\s*\*)*|无应答|无响应|超时|timeout|timed out|no reply)$/i;
  const values = cells.map((cell) => cell.trim());
  return (
    values.every((v) => v === '–') ||
    (values.some((v) => marker.test(v)) &&
      values.every((v) => /^[-–—]?$/.test(v) || marker.test(v)))
  );
}

/** Group a single destination for display; source rows remain untouched. */
export function compactRouteHops(headers: string[], rows: string[][]) {
  if (headers.length < 2 || !/^(跳数|hop|ttl)$/i.test(headers[0].trim()))
    return rows;
  const result: (string[] | SilentHops)[] = [];
  const hopNumbers = rows.map(([label]) =>
    /^[1-9]\d*$/.test(label?.trim()) ? Number(label) : NaN,
  );
  let run: SilentHops | undefined;
  rows.forEach((row, i) => {
    const hop = hopNumbers[i];
    if (
      !Number.isSafeInteger(hop) ||
      row.length !== headers.length ||
      !noReply(row.slice(1))
    ) {
      result.push(row);
      run = undefined;
      return;
    }
    // Multiple probes can occupy separate rows at one TTL.
    const repeated = hop === hopNumbers[i - 1] || hop === hopNumbers[i + 1];
    if (!repeated && run && hop === run.last + 1) {
      run.last = hop;
    } else {
      run = { first: hop, last: hop };
      result.push(run);
    }
    if (repeated) run = undefined;
  });
  return result;
}
