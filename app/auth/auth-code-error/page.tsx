'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCodeError() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page after 5 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">인증 오류 발생</h1>
        <p className="text-gray-700 mb-6">
          로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <p className="text-sm text-gray-500">
          5초 후 자동으로 홈으로 이동합니다...
        </p>
      </div>
    </div>
  );
}
