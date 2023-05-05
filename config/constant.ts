import { PageSettings } from "@/types/settings";

export const defaultSettings: PageSettings = {
    chunkSize: 1000,
    temperature: 1,
    maxTokenLength: 1000,
    topp: 1,
    chunkOverlap: 200
};

export const chunkSize = {
    max: 4000,
    min: 100
};

export const temperature = {
    max: 1,
    min: 0
}

export const maxTokenLength = {
    max: 4097,
    min: 100
}

export const topp = {
    max: 1,
    min: 0
}

export const baseImagePath: string = "public/images/";
export const basePdfPath: string = "public/pdfs/";

export const s3config = {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
    region: process.env.NEXT_PUBLIC_AWS_REGION,
}

export const bucketName = 'doc-chat-s3';
export const imagePath = 'images/';
export const pdfPath = 'pdfPath/';
export const s3Path = process.env.NEXT_PUBLIC_AWS_S3_PATH;