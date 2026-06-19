import type { ProblemStatus } from '../../lib/pas/types';

const STYLES: Record<ProblemStatus, string> = {
  Open: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'In Progress': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Pending: 'bg-gray-100 text-gray-700 border-gray-200',
  Resolved: 'bg-green-100 text-green-800 border-green-200',
};

const LABELS: Record<ProblemStatus, string> = {
  Open: 'Mở',
  'In Progress': 'Đang xử lý',
  Pending: 'Chờ',
  Resolved: 'Đã đóng',
};

export default function ProblemStatusBadge({ status }: { status: ProblemStatus }) {
  const style = STYLES[status] || STYLES.Open;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {LABELS[status] || status}
    </span>
  );
}
