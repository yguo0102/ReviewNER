
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, RefreshCw, Loader2, FileText, Download } from 'lucide-react';
import { HighlightedTextRenderer } from './highlighted-text-renderer';
import type { NerSample } from './types';
import { getOldTextHighlightedParts } from '@/lib/ner-utils';
import { correctNERTags } from '@/ai/flows/correct-ner-tags';
import { useToast } from "@/hooks/use-toast";

const defaultSampleData: NerSample[] = [
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

const parseCsvRow = (row: string): string[] => {
  const values: string[] = [];
  let currentVal = '';
  let inQuotes = false;
  for (let j = 0; j < row.length; j++) {
    const char = row[j];
    if (char === '"') {
      if (inQuotes && j + 1 < row.length && row[j+1] === '"') {
        // Escaped quote
        currentVal += '"';
        j++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentVal);
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  values.push(currentVal); // Add the last value
  // Trim, remove surrounding quotes (if any) that were not part of escaping, and unescape "" to "
  return values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
};


export function NERPageContent() {
  const [activeSamples, setActiveSamples] = useState<NerSample[]>(defaultSampleData);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [originalOldText, setOriginalOldText] = useState<string>('');
  const [currentNewText, setCurrentNewText] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>(['old_text', 'new_text']);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setActiveSamples(updatedSamples);
    }
  }, [activeSamples, currentSampleIndex, currentNewText]);


  useEffect(() => {
    if (currentSampleData) {
      setOriginalOldText(currentSampleData.old_text || '');
      setCurrentNewText(currentSampleData.new_text || '');
      setAnimationKey(prev => prev + 1);
    } else {
      setOriginalOldText('');
      setCurrentNewText('');
       if (activeSamples.length === 0 && defaultSampleData.length > 0) {
        // Initial load or all samples removed, no specific toast here anymore as it's handled by UI state
      }
    }
  }, [currentSampleIndex, activeSamples, currentSampleData]);


  useEffect(() => {
    if (activeSamples.length === 0 && defaultSampleData.length === 0) {
         toast({
            title: "No Samples Loaded",
            description: "Upload a CSV or refresh to use default samples.",
            variant: "default",
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

  const handleAiCorrect = async () => {
    const currentOldText = currentSampleData?.old_text;
    if (!currentOldText && !currentNewText && activeSamples.length === 0) {
      toast({
        title: "No Data",
        description: "Load a sample before using AI Correct.",
        variant: "default",
      });
      return;
    }
    setIsLoadingAi(true);
    try {
      const result = await correctNERTags({
        old_text: currentOldText || '', // Use current sample's old_text
        new_text: currentNewText,
      });
      if (result && result.corrected_text) {
        setCurrentNewText(result.corrected_text);
        if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
          const updatedSamples = [...activeSamples];
          const sampleToUpdate = { ...updatedSamples[currentSampleIndex] };
          sampleToUpdate.data = { ...sampleToUpdate.data, new_text: result.corrected_text };
          updatedSamples[currentSampleIndex] = sampleToUpdate;
          setActiveSamples(updatedSamples);
        }
        setAnimationKey(prev => prev + 1);
        toast({
          title: "AI Correction Applied",
          description: "The new text has been updated with AI suggestions.",
        });
      } else {
        toast({
          title: "AI Correction Failed",
          description: "Could not get corrections from AI.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI Correction error:", error);
      toast({
          title: "AI Correction Error",
          description: "An error occurred while applying AI corrections.",
          variant: "destructive",
      });
    } finally {
      setIsLoadingAi(false);
    }
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

      const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
      if (rows.length < 2) {
        toast({
          title: "Invalid CSV Format",
          description: "CSV must contain a header and at least one data row.",
          variant: "destructive",
        });
        return;
      }

      const headerFromFile = parseCsvRow(rows[0]).map(h => h.trim().toLowerCase());
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
      setCsvHeaders(headerFromFile); // Store all headers

      const newSamples: NerSample[] = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue; // Skip empty lines
        const values = parseCsvRow(rows[i]);
        const rowData: Record<string, string> = {};
        headerFromFile.forEach((headerName, colIndex) => {
          rowData[headerName] = values[colIndex] || '';
        });

        if (rowData.old_text && rowData.new_text) { // Basic validation
            newSamples.push({ id: `csv_sample_${Date.now()}_${i}`, data: rowData });
        }
      }

      if (newSamples.length === 0) {
        toast({
          title: "No Valid Data",
          description: "No valid samples found in the CSV file. Ensure 'old_text' and 'new_text' have values.",
          variant: "destructive",
        });
        return;
      }

      setActiveSamples(newSamples);
      setCurrentSampleIndex(0);
      toast({
        title: "CSV Uploaded",
        description: `${newSamples.length} samples loaded successfully.`,
      });
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

    // Use a brief timeout to allow state to potentially update from saveCurrentSampleEdits
    // This is a common pattern but ideally saveCurrentSampleEdits would return the updated samples or be synchronous regarding the data it modifies for export.
    // For this case, `activeSamples` state itself is updated, so the timeout helps ensure the `map` below uses the most recent version.
    setTimeout(() => {
      const headersToExport = csvHeaders.length > 0 ? csvHeaders : ['old_text', 'new_text'];
      const csvHeaderRow = headersToExport.map(escapeCSVField).join(',') + '\n';

      const csvRows = activeSamples.map(sample => {
        return headersToExport.map(headerName => {
          return escapeCSVField(sample.data[headerName]);
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
    }, 100); // Small delay for state update to propagate
  };


  const oldTextHighlightedSegments = useMemo(() => {
    if (!originalOldText) return [];
    return getOldTextHighlightedParts(originalOldText, currentNewText);
  }, [originalOldText, currentNewText]);


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
          <Button onClick={handleLoadNextSample} variant="outline" disabled={activeSamples.length <= 1 && currentSampleIndex === 0}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Load Next Sample
          </Button>
          <Button onClick={handleAiCorrect} disabled={isLoadingAi || activeSamples.length === 0 || !currentSampleData}>
            {isLoadingAi ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI Correct
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
               <Button onClick={() => {setActiveSamples(defaultSampleData); setCurrentSampleIndex(0); setCsvHeaders(['old_text', 'new_text']);}} className="mt-4 ml-2" variant="secondary" disabled={defaultSampleData.length === 0}>
                Load Default Samples
              </Button>
            </CardContent>
          </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Original Text (Read-only)</CardTitle>
              <CardDescription>This is the original text content. Current sample: {currentSampleIndex + 1} of {activeSamples.length}</CardDescription>
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
