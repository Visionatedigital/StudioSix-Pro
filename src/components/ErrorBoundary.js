import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    // Check if it's a network/fetch related error
    if (error.message && (
      error.message.includes('Failed to fetch') || 
      error.message.includes('NetworkError') ||
      error.message.includes('fetch')
    )) {
      console.warn('⚠️ Network error detected - likely browser extension interference');
    }
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Don't show error UI for network errors - just log and continue
      if (this.state.error && this.state.error.message && 
          this.state.error.message.includes('Failed to fetch')) {
        console.warn('🔄 Suppressing fetch error UI - continuing with app');
        return this.props.children;
      }
      
      // Show error UI for other errors
      return (
        <div className="error-boundary p-6 bg-red-50 border border-red-200 rounded-lg m-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4">
            An error occurred while rendering the application.
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-red-700">Error Details</summary>
              <pre className="text-sm bg-red-100 p-2 mt-2 overflow-auto">
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;