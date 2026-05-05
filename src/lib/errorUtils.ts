export function formatError(err: any, defaultMsg: string = "An unknown error occurred"): string {
  const msg = err?.message || String(err) || defaultMsg;
  if (msg.includes('Failed to fetch')) {
    return 'Lỗi kết nối: Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng của bạn (Failed to fetch).';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Sai thông tin đăng nhập: Email hoặc mật khẩu không chính xác.';
  }
  if (msg.includes('LockManager') || msg.includes('timed out waiting')) {
    return 'Lỗi tải phiên: Vui lòng làm mới lại trang.';
  }
  return msg;
}
