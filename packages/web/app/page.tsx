import { apiClient } from '@/src/api-client';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            YouTube Summary Service
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Web client for AI-powered YouTube video summarization. 
            This client communicates with the API server to provide summaries in multiple languages.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              🚀 Quick Start
            </h2>
            <ol className="space-y-2 text-gray-600">
              <li>1. Start the API server on port 3000</li>
              <li>2. Enter a YouTube URL</li>
              <li>3. Select your preferred language</li>
              <li>4. Get AI-powered summary</li>
            </ol>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              ⚡ Features
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li>• Multi-language summaries</li>
              <li>• Real-time processing</li>
              <li>• User-friendly interface</li>
              <li>• Mobile responsive design</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Server Status
            </h3>
            <p className="text-blue-700 text-sm">
              Make sure the API server is running on {process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}