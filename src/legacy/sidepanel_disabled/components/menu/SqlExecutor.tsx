import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { Database } from 'lucide-react';

interface SqlExecutorProps {
  onClose: () => void;
}

export const SqlExecutor = ({ onClose }: SqlExecutorProps) => {
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const executeSql = async (query: string) => {
    setSqlError(null);
    setSqlResult(null);
    try {
      const response = await browser.runtime.sendMessage({ 
        type: 'EXECUTE_SQL', 
        payload: { sql: query } 
      });
      if (response.success) {
        setSqlResult(response.data);
      } else {
        setSqlError(response.error || 'Execution failed');
      }
    } catch (e: any) {
      setSqlError(e.message);
    }
  };

  const handleExecuteSql = () => executeSql(sqlQuery);

  const handleQuickQuery = (query: string) => {
    setSqlQuery(query);
    executeSql(query);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            SQL Executor
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      
      <div className="flex gap-2 mb-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleQuickQuery('SELECT * FROM folders')}
        >
          Folders
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleQuickQuery('SELECT * FROM conversations')}
        >
          Conversations
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleQuickQuery('SELECT * FROM messages')}
        >
          Messages
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <textarea 
          className="flex-1 p-2 rounded-md border bg-transparent text-sm font-mono h-24 focus:outline-none focus:ring-1 focus:ring-ring"
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          placeholder="SELECT * FROM folders"
        />
      </div>
      <Button onClick={handleExecuteSql} className="mb-4">Execute</Button>
      
      {sqlError && (
        <div className="p-2 bg-destructive/10 text-destructive text-sm rounded mb-4">
          {sqlError}
        </div>
      )}

      {sqlResult && (
        <ScrollArea className="flex-1 border rounded-md">
          <div className="p-2">
            {sqlResult.length === 0 ? (
              <div className="text-muted-foreground text-sm">No results</div>
            ) : (
              <div className="min-w-full inline-block align-middle">
                <table className="min-w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {Object.keys(sqlResult[0]).map(key => (
                      <th key={key} className="p-2 font-medium text-muted-foreground">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sqlResult.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                      {Object.values(row).map((val: any, j) => (
                        <SimpleTooltip content={String(val)} key={j}>
                          <td className="p-2 max-w-[200px] truncate border-r last:border-r-0">
                            {String(val)}
                          </td>
                        </SimpleTooltip>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

