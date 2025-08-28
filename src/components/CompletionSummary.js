/**
 * CompletionSummary - Detailed project completion summary with markdown formatting
 */

import React, { useState, useEffect } from 'react';

const CompletionSummary = ({ summaryLines, onComplete = null, className = "" }) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [visibleLines, setVisibleLines] = useState([]);

  useEffect(() => {
    if (!summaryLines || summaryLines.length === 0) return;

    const showNextLine = () => {
      if (currentLine < summaryLines.length) {
        const timer = setTimeout(() => {
          setVisibleLines(prev => [...prev, summaryLines[currentLine]]);
          setCurrentLine(prev => prev + 1);
        }, currentLine * 300); // 300ms delay between lines (faster for completion)

        return timer;
      } else if (onComplete) {
        const completionTimer = setTimeout(onComplete, 500);
        return completionTimer;
      }
    };

    const timer = showNextLine();
    return () => clearTimeout(timer);
  }, [currentLine, summaryLines, onComplete]);

  // Reset when summaryLines change
  useEffect(() => {
    setCurrentLine(0);
    setVisibleLines([]);
  }, [summaryLines]);

  if (!summaryLines || summaryLines.length === 0) return null;

  const formatLine = (line, index) => {
    // Empty lines for spacing
    if (line.trim() === '') {
      return <div key={index} className="h-2" />;
    }

    // Main headings (##)
    if (line.startsWith('## ')) {
      return (
        <h3 key={index} className="text-lg font-bold text-white mt-4 mb-2 flex items-center">
          {line.replace('## ', '')}
        </h3>
      );
    }

    // Bold text with checkmarks or main announcements
    if (line.includes('**') && (line.includes('✅') || line.includes('🎉'))) {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/✅/g, '<span class="text-green-400">✅</span>')
        .replace(/🎉/g, '<span class="text-yellow-400">🎉</span>');
      
      return (
        <div 
          key={index} 
          className="text-sm mb-1"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    }

    // Bullet points
    if (line.startsWith('• ')) {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
        .replace(/🟫|🧱|🚪|🔧/g, '<span class="mr-1">$&</span>');
      
      return (
        <div 
          key={index} 
          className="text-sm text-gray-300 mb-1 ml-2"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    }

    // Final summary line
    if (line.includes('🎯')) {
      return (
        <div key={index} className="text-sm text-blue-300 font-medium mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-800/30">
          {line}
        </div>
      );
    }

    // Regular text with bold formatting
    const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
    return (
      <div 
        key={index} 
        className="text-sm text-gray-300 mb-1"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  };

  return (
    <div className={`completion-summary ${className}`}>
      {visibleLines.map((line, index) => (
        <div
          key={index}
          className="line-fade-in"
          style={{
            animationDelay: `${index * 0.05}s`,
            animationDuration: '0.4s'
          }}
        >
          {formatLine(line, index)}
        </div>
      ))}
      
      <style jsx>{`
        .completion-summary {
          line-height: 1.4;
        }
        
        .line-fade-in {
          opacity: 0;
          animation: fadeInUp 0.4s ease-out forwards;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CompletionSummary;