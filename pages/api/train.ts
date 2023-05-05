import type { NextApiRequest, NextApiResponse } from 'next'
import { PineconeClient } from '@pinecone-database/pinecone'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { OpenAIEmbeddings } from 'langchain/embeddings'
import { PineconeStore } from 'langchain/vectorstores'
import { defaultSettings, pdfPath, s3Path } from '@/config/constant'
import isEmpty from '@/utils/isEmpty'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';

if (!process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_API_KEY) {
    throw new Error('Pinecone environment or api key vars missing')
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    const { files, settings, namespace, key } = req.body

    //Ask a question
    try {
        let rawDocs: Document[] = []

        if (!isEmpty(files)) {
            for (let i = 0; i < files.length; i++) {
                console.log(s3Path + pdfPath + files[i].filename);
                const pdfloader = getDocument(s3Path + pdfPath + files[i].filename);
                const pdf = await (pdfloader.promise);
                let maxPages = pdf._pdfInfo.numPages;
                let text = "";
                for (let j = 1; j <= maxPages; j++) {
                    let page = await pdf.getPage(j);
                    let pageContext = await page.getTextContent();
                    text += pageContext.items.map((s: any) => { return s.str }).join('');
                }
                const docs = new Document({
                    pageContent: text,
                    metadata: {
                        source: files[i].filename
                    }
                });
                rawDocs.push(docs);
            }
        } else {
            res.status(400).json('Parameter Error');
            return;
        }

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: settings.chunkSize,
            chunkOverlap: defaultSettings.chunkOverlap,
        })

        const docs = await textSplitter.splitDocuments(rawDocs)

        const pinecone = new PineconeClient()
        await pinecone.init({
            environment: process.env.PINECONE_ENVIRONMENT ?? '',
            apiKey: process.env.PINECONE_API_KEY ?? ''
        })
        const index = pinecone.Index(process.env.PINECONE_INDEX_NAME ?? "")

        const embeddings = new OpenAIEmbeddings({ openAIApiKey: key })

        const chunkSize = 50

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        })
        for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            res.write(`${30 + Math.ceil(70 * i / docs.length)}`)
            await PineconeStore.fromDocuments(
                chunk,
                embeddings,
                {
                    pineconeIndex: index,
                    namespace: namespace,
                    textKey: 'text'
                }
            )
        }
    } catch (error) {
        console.log(error)
        res.status(500).write(JSON.stringify(error))
        return
    } finally {
        res.write('[DONE]')
        res.end()
    }
}