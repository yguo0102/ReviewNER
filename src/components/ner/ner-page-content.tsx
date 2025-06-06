
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import { HighlightedTextRenderer } from './highlighted-text-renderer';
import type { NerSample } from './types';
import { getOldTextHighlightedParts } from '@/lib/ner-utils';
import { useToast } from "@/hooks/use-toast";

const initialDefaultSampleData: Omit<NerSample, 'original_new_text'>[] = [
  {
    id: 'sample1',
    data: {
      old_text: "John went to the Emory clinic for a routine exam on Jan 5, 2023.",
      new_text: "<name> went to the <location> clinic for a routine exam on <date>."
    }
  },
  {
    id: 'sample2',
    data: {
      old_text: "Meet me at Times Square tomorrow afternoon.",
      new_text: "Meet me at <location> <date>."
    }
  },
  {
    id: 'sample3',
    data: {
      old_text: "The patient, Jane Doe, reported fever starting on 2024-03-10.",
      new_text: "The patient, <name>, reported fever starting on <date>."
    }
  },
];

const prepareDefaultSamples = (): NerSample[] => {
  return initialDefaultSampleData.map(s => ({
    ...s,
    original_new_text: s.data.new_text,
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
  const [csvHeaders, setCsvHeaders] = useState<string[]>(['old_text', 'new_text']);
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
          // Cached samples are empty, load defaults
          setActiveSamples(prepareDefaultSamples());
          setCurrentSampleIndex(0);
          setCsvHeaders(['old_text', 'new_text']);
        }
      } else {
        // No cached samples, load defaults
        setActiveSamples(prepareDefaultSamples());
        setCurrentSampleIndex(0);
        setCsvHeaders(['old_text', 'new_text']);
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      // Fallback to defaults if parsing fails
      setActiveSamples(prepareDefaultSamples());
      setCurrentSampleIndex(0);
      setCsvHeaders(['old_text', 'new_text']);
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
    if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
      const updatedSamples = [...activeSamples];
      const sampleToUpdate = { ...updatedSamples[currentSampleIndex] };
      sampleToUpdate.data = { ...sampleToUpdate.data, new_text: currentNewText };
      updatedSamples[currentSampleIndex] = sampleToUpdate;
      setActiveSamples(updatedSamples); // This will trigger the useEffect to save to localStorage
    }
  }, [activeSamples, currentSampleIndex, currentNewText]);


  useEffect(() => {
    if (currentSampleData) {
      setOriginalOldText(currentSampleData.old_text || '');
      setCurrentNewText(currentSampleData.new_text || '');
      setAnimationKey(prev => prev + 1);
    } else if (isLoaded && activeSamples.length === 0) { // Only if loaded and truly no samples
      setOriginalOldText('');
      setCurrentNewText('');
    }
  }, [currentSampleIndex, activeSamples, currentSampleData, isLoaded]);


  useEffect(() => {
    // This effect now primarily handles initial toast if defaults are empty and no cache
    if (isLoaded && activeSamples.length === 0 && initialDefaultSampleData.length === 0) {
         toast({
            title: "No Samples Loaded",
            description: "Upload a CSV or ensure default samples are available.",
            variant: "default",
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]); // Depends on isLoaded to ensure it runs after attempting to load from cache


  const handleNewTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentNewText(event.target.value);
    // Auto-save on text change might be too frequent.
    // Edits are saved to activeSamples (and thus localStorage) upon navigation by saveCurrentSampleEdits.
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
      const text = e.target?.result as string;
      if (!text) {
        toast({
          title: "File Read Error",
          description: "Could not read the file content.",
          variant: "destructive",
        });
        return;
      }

      const parsedRows = parseCsvRows(text);

      if (parsedRows.length < 1) { 
        toast({
          title: "Invalid CSV Format",
          description: "CSV must contain a header row.",
          variant: "destructive",
        });
        return;
      }
      
      const headerFromFile = parsedRows[0].map(h => h.trim().toLowerCase());
      const oldTextIndex = headerFromFile.indexOf('old_text');
      const newTextIndex = headerFromFile.indexOf('new_text');

      if (oldTextIndex === -1 || newTextIndex === -1) {
        toast({
          title: "Missing Columns",
          description: "CSV must contain 'old_text' and 'new_text' columns.",
          variant: "destructive",
        });
        return;
      }
      setCsvHeaders(headerFromFile); // This will trigger useEffect to save to localStorage

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

        if (rowData.old_text !== undefined && rowData.new_text !== undefined) {
            newSamples.push({
              id: `csv_sample_${Date.now()}_${i}`,
              data: rowData,
              original_new_text: rowData.new_text 
            });
        }
      }


      if (newSamples.length === 0 && dataRows.length > 0) {
         toast({
          title: "No Valid Data Rows",
          description: "No valid samples found in the CSV after the header. Ensure 'old_text' and 'new_text' columns are present and rows match header count.",
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

      setActiveSamples(newSamples); // This will trigger useEffect to save to localStorage
      setCurrentSampleIndex(0); // This will trigger useEffect to save to localStorage
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

    saveCurrentSampleEdits(); // Ensure last edits are in activeSamples

    // Use a timeout to allow activeSamples state to update from saveCurrentSampleEdits if needed
    // before accessing it for export. This ensures the latest data is used.
    setTimeout(() => {
      const currentSamplesForExport = activeSamples; // Use the state variable directly

      const baseExportHeaders = csvHeaders.length > 0 ? csvHeaders : ['old_text', 'new_text'];
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

        const isChanged = sample.original_new_text !== undefined && sample.data.new_text !== sample.original_new_text;
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
    }, 100); // 100ms delay to ensure state update is processed
  };


  const oldTextHighlightedSegments = useMemo(() => {
    if (!originalOldText && !currentNewText && activeSamples.length === 0) return [];
    return getOldTextHighlightedParts(originalOldText || '', currentNewText || '');
  }, [originalOldText, currentNewText, activeSamples.length]);

  if (!isLoaded) {
    return (
      <div className="flex flex-col flex-grow p-4 md:p-6 lg:p-8 space-y-6 items-center justify-center">
        <p>Loading ReviewNER...</p>
        {/* Optionally, add a spinner or skeleton loader here */}
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
          <Button onClick={handleLoadPreviousSample} variant="outline" disabled={activeSamples.length <= 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous Sample
          </Button>
          <Button onClick={handleLoadNextSample} variant="outline" disabled={activeSamples.length <= 1}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Next Sample
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
                  setCsvHeaders(['old_text', 'new_text']);
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
              <CardDescription>This is the original text content. Current sample: {activeSamples.length > 0 ? currentSampleIndex + 1 : 0} of {activeSamples.length}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-6 bg-muted/30 rounded-b-lg min-h-[200px] overflow-auto">
              <HighlightedTextRenderer segments={oldTextHighlightedSegments} animationKey={animationKey} />
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>New Text (Editable)</CardTitle>
              <CardDescription>Edit the text below. Use tags like &lt;name&gt;, &lt;location&gt;, &lt;date&gt;.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-0">
              <Textarea
                value={currentNewText}
                onChange={handleNewTextChange}
                placeholder="Enter new text with NER tags..."
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

