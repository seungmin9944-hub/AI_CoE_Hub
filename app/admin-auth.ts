// Cloudflare Access 연결 전까지 모든 관리자 쓰기 요청을 잠급니다.
// 추후 Access가 전달하는 검증된 사용자 헤더로 이 함수를 교체합니다.
export async function isAdminUser() {
  return false;
}
