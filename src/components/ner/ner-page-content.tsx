
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Download, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { HighlightedTextRenderer } from './highlighted-text-renderer';
import type { NerSample } from './types';
import { getOldTextHighlightedParts } from '@/lib/ner-utils';
import { useToast } from "@/hooks/use-toast";

const initialDefaultSampleData: Omit<NerSample, 'original_new_text'>[] = [
  {
    id: 'sample1',
    data: {
      text: "John went to the Emory clinic for a routine exam on Jan 5, 2023.",
      deid_text: "<name> went to the <location> clinic for a routine exam on <date>.",
      champsid: "CH001"
    }
  },
  {
    id: 'sample2',
    data: {
      text: "Meet me at Times Square tomorrow afternoon.",
      deid_text: "Meet me at <location> <date>.",
      champsid: "CH002"
    }
  },
  {
    id: 'sample3',
    data: {
      text: "The patient, Jane Doe, reported fever starting on 2024-03-10.",
      deid_text: "The patient, <name>, reported fever starting on <date>.",
      champsid: "CH003"
    }
  },
];

const prepareDefaultSamples = (): NerSample[] => {
  return initialDefaultSampleData.map(s => ({
    ...s,
    original_new_text: s.data.deid_text,
  }));
};


const escapeCSVField = (field: string | undefined | null): string => {
  if (field === null || field === undefined) {
    return '';
  }
  let result = String(field);
  result = result.replace(/"/g, '""'); // Escape double quotes
  if (result.search(/("|,|\n)/g) >= 0) {
    result = `"${result}"`; // Enclose in double quotes if it contains problematic characters
  }
  return result;
};

const parseCsvRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
        currentField += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
        i++; 
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) { 
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some(field => field.length > 0) || rows.length === 0 && currentRow.length > 0 ) {
     if (csvText.trim().length > 0 && (currentRow.length > 0 && currentRow.some(f => f.length >0))) {
        rows.push(currentRow);
     }
  }
  
  return rows.filter(row => row.length > 0 && row.some(field => field.trim() !== ''));
};

const NER_APP_ACTIVE_SAMPLES_KEY = 'nerAppActiveSamples';
const NER_APP_CURRENT_SAMPLE_INDEX_KEY = 'nerAppCurrentSampleIndex';
const NER_APP_CSV_HEADERS_KEY = 'nerAppCsvHeaders';


export function NERPageContent() {
  const [activeSamples, setActiveSamples] = useState<NerSample[]>([]);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [originalOldText, setOriginalOldText] = useState<string>('');
  const [currentNewText, setCurrentNewText] = useState<string>('');
  const [animationKey, setAnimationKey] = useState(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>(['text', 'deid_text', 'champsid']);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);


  useEffect(() => {
    try {
      const cachedSamples = localStorage.getItem(NER_APP_ACTIVE_SAMPLES_KEY);
      const cachedIndex = localStorage.getItem(NER_APP_CURRENT_SAMPLE_INDEX_KEY);
      const cachedHeaders = localStorage.getItem(NER_APP_CSV_HEADERS_KEY);

      if (cachedSamples) {
        const parsedSamples: NerSample[] = JSON.parse(cachedSamples);
        if (parsedSamples.length > 0) {
          setActiveSamples(parsedSamples);
          if (cachedIndex) {
            const parsedIndex = parseInt(cachedIndex, 10);
            setCurrentSampleIndex(parsedIndex >= 0 && parsedIndex < parsedSamples.length ? parsedIndex : 0);
          }
          if (cachedHeaders) {
            setCsvHeaders(JSON.parse(cachedHeaders));
          }
        } else {
          setActiveSamples(prepareDefaultSamples());
          setCurrentSampleIndex(0);
          setCsvHeaders(['text', 'deid_text', 'champsid']);
        }
      } else {
        setActiveSamples(prepareDefaultSamples());
        setCurrentSampleIndex(0);
        setCsvHeaders(['text', 'deid_text', 'champsid']);
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      setActiveSamples(prepareDefaultSamples());
      setCurrentSampleIndex(0);
      setCsvHeaders(['text', 'deid_text', 'champsid']);
    }
    setIsLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(NER_APP_ACTIVE_SAMPLES_KEY, JSON.stringify(activeSamples));
    }
  }, [activeSamples, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(NER_APP_CURRENT_SAMPLE_INDEX_KEY, String(currentSampleIndex));
    }
  }, [currentSampleIndex, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(NER_APP_CSV_HEADERS_KEY, JSON.stringify(csvHeaders));
    }
  }, [csvHeaders, isLoaded]);


  const currentSampleData = useMemo(() => {
    if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
      return activeSamples[currentSampleIndex].data;
    }
    return null;
  }, [activeSamples, currentSampleIndex]);


  const saveCurrentSampleEdits = useCallback(() => {
    if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length && currentSampleData) {
      const updatedSamples = [...activeSamples];
      const sampleToUpdate = { ...updatedSamples[currentSampleIndex] };
      // Ensure data object exists before trying to spread it
      sampleToUpdate.data = { ...(sampleToUpdate.data || {}), deid_text: currentNewText };
      updatedSamples[currentSampleIndex] = sampleToUpdate;
      setActiveSamples(updatedSamples); 
    }
  }, [activeSamples, currentSampleIndex, currentNewText, currentSampleData]);


  useEffect(() => {
    if (currentSampleData) {
      setOriginalOldText(currentSampleData.text || '');
      setCurrentNewText(currentSampleData.deid_text || '');
      setAnimationKey(prev => prev + 1);
    } else if (isLoaded && activeSamples.length === 0) { 
      setOriginalOldText('');
      setCurrentNewText('');
    }
  }, [currentSampleIndex, activeSamples, currentSampleData, isLoaded]);


  useEffect(() => {
    if (isLoaded && activeSamples.length === 0 && initialDefaultSampleData.length === 0) {
         toast({
            title: "No Samples Loaded",
            description: "Upload a CSV or ensure default samples are available.",
            variant: "default",
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]); 


  const handleNewTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentNewText(event.target.value);
  };

  const handleLoadNextSample = () => {
    if (activeSamples.length === 0) {
       toast({
          title: "No Samples",
          description: "Upload a CSV file to load samples.",
          variant: "default",
        });
        return;
    }
    saveCurrentSampleEdits();
    setCurrentSampleIndex((prevIndex) => (prevIndex + 1) % activeSamples.length);
  };

  const handleLoadPreviousSample = () => {
    if (activeSamples.length === 0) {
      toast({
        title: "No Samples",
        description: "Upload a CSV file to load samples.",
        variant: "default",
      });
      return;
    }
    saveCurrentSampleEdits();
    setCurrentSampleIndex((prevIndex) => (prevIndex - 1 + activeSamples.length) % activeSamples.length);
  };


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'text/csv') {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const textContent = e.target?.result as string;
      if (!textContent) {
        toast({
          title: "File Read Error",
          description: "Could not read the file content.",
          variant: "destructive",
        });
        return;
      }

      const parsedRows = parseCsvRows(textContent);

      if (parsedRows.length < 1) { 
        toast({
          title: "Invalid CSV Format",
          description: "CSV must contain a header row.",
          variant: "destructive",
        });
        return;
      }
      
      const headerFromFile = parsedRows[0].map(h => h.trim().toLowerCase());
      const textIndex = headerFromFile.indexOf('text');
      const deidTextIndex = headerFromFile.indexOf('deid_text');

      if (textIndex === -1 || deidTextIndex === -1) {
        toast({
          title: "Missing Columns",
          description: "CSV must contain 'text' and 'deid_text' columns.",
          variant: "destructive",
        });
        return;
      }
      setCsvHeaders(headerFromFile); 

      const newSamples: NerSample[] = [];
      const dataRows = parsedRows.length > 1 ? parsedRows.slice(1) : [];


      for (let i = 0; i < dataRows.length; i++) {
        const values = dataRows[i];
        if (values.length !== headerFromFile.length) {
          toast({
            title: "CSV Parsing Warning",
            description: `Row ${i+2} has an inconsistent number of columns and was skipped.`,
            variant: "default"
          })
          continue; 
        }
        const rowData: Record<string, string> = {};
        headerFromFile.forEach((headerName, colIndex) => {
          rowData[headerName] = values[colIndex] || '';
        });

        if (rowData.text !== undefined && rowData.deid_text !== undefined) {
            newSamples.push({
              id: `csv_sample_${Date.now()}_${i}`,
              data: rowData,
              original_new_text: rowData.deid_text 
            });
        }
      }


      if (newSamples.length === 0 && dataRows.length > 0) {
         toast({
          title: "No Valid Data Rows",
          description: "No valid samples found in the CSV after the header. Ensure 'text' and 'deid_text' columns are present and rows match header count.",
          variant: "destructive",
        });
        return;
      }
       if (newSamples.length === 0 && dataRows.length === 0) {
         toast({
          title: "No Data Rows",
          description: "The CSV file contains only a header row or is empty.",
          variant: "default",
        });
      }

      setActiveSamples(newSamples); 
      setCurrentSampleIndex(0); 
      if (newSamples.length > 0) {
        toast({
            title: "CSV Uploaded",
            description: `${newSamples.length} samples loaded successfully.`,
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "An error occurred while reading the file.",
        variant: "destructive",
      });
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleExportCSV = () => {
    if (activeSamples.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Load or create some samples first.",
        variant: "default",
      });
      return;
    }

    saveCurrentSampleEdits(); 

    setTimeout(() => {
      const currentSamplesForExport = activeSamples; 

      const baseExportHeaders = csvHeaders.length > 0 ? csvHeaders : ['text', 'deid_text'];
      const finalExportHeaders = [...baseExportHeaders];
      if (!finalExportHeaders.includes('is_changed')) {
        finalExportHeaders.push('is_changed');
      }

      const csvHeaderRow = finalExportHeaders.map(escapeCSVField).join(',') + '\n';

      const csvRows = currentSamplesForExport.map(sample => {
        const rowDataForExport: Record<string, string | undefined | null> = {};
        
        baseExportHeaders.forEach(header => {
            rowDataForExport[header] = sample.data[header];
        });
        
        rowDataForExport['deid_text'] = sample.data.deid_text;


        const isChanged = sample.original_new_text !== undefined && sample.data.deid_text !== sample.original_new_text;
        rowDataForExport.is_changed = isChanged ? 'true' : 'false';
        
        return finalExportHeaders.map(headerName => {
          return escapeCSVField(rowDataForExport[headerName]);
        }).join(',');
      }).join('\n');
      
      const csvContent = csvHeaderRow + csvRows;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "edited_ner_data.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({
          title: "Export Successful",
          description: "Edited data downloaded as edited_ner_data.csv.",
        });
      } else {
         toast({
          title: "Export Failed",
          description: "Your browser doesn't support this download method.",
          variant: "destructive",
        });
      }
    }, 100); 
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem(NER_APP_ACTIVE_SAMPLES_KEY);
      localStorage.removeItem(NER_APP_CURRENT_SAMPLE_INDEX_KEY);
      localStorage.removeItem(NER_APP_CSV_HEADERS_KEY);

      setActiveSamples(prepareDefaultSamples());
      setCurrentSampleIndex(0);
      setCsvHeaders(['text', 'deid_text', 'champsid']);
      // Trigger re-render for text areas via useEffect dependencies
      setAnimationKey(prev => prev + 1); 

      toast({
        title: "Cache Cleared",
        description: "Application state has been reset to defaults.",
      });
    } catch (error) {
      console.error("Error clearing localStorage:", error);
      toast({
        title: "Cache Clear Error",
        description: "Could not clear application cache.",
        variant: "destructive",
      });
    }
  };


  const oldTextHighlightedSegments = useMemo(() => {
    if (!originalOldText && !currentNewText && activeSamples.length === 0) return [];
    return getOldTextHighlightedParts(originalOldText || '', currentNewText || '');
  }, [originalOldText, currentNewText, activeSamples.length]);

  if (!isLoaded) {
    return (
      <div className="flex flex-col flex-grow p-4 md:p-6 lg:p-8 space-y-6 items-center justify-center">
        <p>Loading ReviewNER...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col flex-grow p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold font-headline">NER Review Tool</h1>
        <div className="flex gap-2 flex-wrap justify-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <Button onClick={triggerFileUpload} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Upload CSV
          </Button>
          <Button onClick={handleExportCSV} variant="outline" disabled={activeSamples.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
           <Button onClick={handleClearCache} variant="outline">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Cache
          </Button>
          <Button onClick={handleLoadPreviousSample} variant="outline" disabled={activeSamples.length <= 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button onClick={handleLoadNextSample} variant="outline" disabled={activeSamples.length <= 1}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Next
          </Button>
        </div>
      </div>

      {activeSamples.length === 0 ? (
         <Card className="flex flex-col items-center justify-center min-h-[400px]">
            <CardHeader>
              <CardTitle className="text-center">No Samples Loaded</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Please upload a CSV file to start reviewing NER tags or load default samples.
              </p>
              <Button onClick={triggerFileUpload} className="mt-4">
                <FileText className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
               <Button 
                onClick={() => {
                  const defaultSamps = prepareDefaultSamples();
                  setActiveSamples(defaultSamps); 
                  setCurrentSampleIndex(0); 
                  setCsvHeaders(['text', 'deid_text', 'champsid']);
                  if (defaultSamps.length > 0) {
                     toast({ title: "Default samples loaded." });
                  } else {
                     toast({ title: "No default samples available.", variant: "default"});
                  }
                }} 
                className="mt-4 ml-2" 
                variant="secondary" 
                disabled={initialDefaultSampleData.length === 0}
              >
                Load Default Samples
              </Button>
            </CardContent>
          </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Original Text (Read-only)</CardTitle>
              <CardDescription>
                Current sample: {activeSamples.length > 0 ? currentSampleIndex + 1 : 0} of {activeSamples.length}
                {currentSampleData?.champsid && <span className="ml-4 font-medium text-foreground">ChampsID: {currentSampleData.champsid}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-6 bg-muted/30 rounded-b-lg min-h-[200px] overflow-auto">
              <HighlightedTextRenderer segments={oldTextHighlightedSegments} animationKey={animationKey} />
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>De-identified Text (Editable)</CardTitle>
              <CardDescription>Edit the text below. Use tags like &lt;name&gt;, &lt;location&gt;, &lt;date&gt;.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-0">
              <Textarea
                value={currentNewText}
                onChange={handleNewTextChange}
                placeholder="Enter de-identified text with NER tags..."
                className="h-full min-h-[200px] w-full resize-none border-0 rounded-t-none rounded-b-lg focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={!currentSampleData}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

