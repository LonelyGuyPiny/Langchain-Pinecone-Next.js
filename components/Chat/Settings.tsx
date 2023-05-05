/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
import { IconArrowLeft } from '@tabler/icons-react';
import {
  FC,
  memo,
  useEffect,
  useState,
} from 'react';
import { Button, Divider, Form, InputNumber, Spin, Upload, notification } from 'antd';
import { InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { PageSettings } from '@/types/settings';
import { UploadChangeParam, UploadFile } from 'antd/es/upload';
import { bucketName, chunkSize, imagePath, maxTokenLength, pdfPath, s3Path, s3config, temperature, topp } from '@/config/constant';
import isEmpty from '@/utils/isEmpty';
import S3 from 'aws-sdk/clients/s3';

const { Dragger } = Upload;

interface Props {
  onToChatPage: (e: boolean) => void;
  setSettings: (setting: PageSettings) => void;
  settings: PageSettings;
  namespace: string;
  showSettingPage: boolean;
  key: string;
}

export const Settings: FC<Props> = memo(
  ({
    settings,
    onToChatPage,
    namespace,
    showSettingPage,
    setSettings,
  }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [imageList, setImageList] = useState<UploadFile[]>([]);
    const [pdfList, setPdfList] = useState<UploadFile[]>([]);
    const s3 = new S3(s3config);
    
    const onFinish = async (e: any) => {
        console.log(imageList);
        setSettings({
            chunkSize: e.chunkSize,
            maxTokenLength: e.maxTokenLength,
            temperature: e.temperature,
            topp: e.topp,
            avatar: imageList.length > 0 ? {
                ...imageList[0],
                response: {
                    url: s3Path + imagePath + imageList[0].name.replace(' ', '')
                }
            } : undefined
        });
        onToChatPage(false);
    }

    const handleChange = (info: UploadChangeParam<UploadFile<any>>) => {
        setImageList(info.fileList);
    }

    const handlebeforeUpload = async (info: UploadFile) => {
        try {
            const params = {
                Bucket: bucketName,
                Key: imagePath + info.name.replace(' ', ''),
                Body: info,
            };
            setLoading(true);
            const upload = s3.upload(params);
            upload.on('httpUploadProgress', (p) => {
                console.log(p.loaded / p.total);
            });
            await upload.promise();
            console.log(`File uploaded successfully: ${info.name}`);
            notification.success({
                message: "Success",
                description: 'Files were uploaded successfully',
                duration: 2
            })
            setLoading(false);
            return false;
        } catch (err) {
            notification.error({
                message: "Error",
                description: 'Upload Error',
                duration: 2
            })
            setLoading(false);
            return Upload.LIST_IGNORE;
        }
    }
    
    const uploadButton = (
        <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>Upload</div>
        </div>
    );

    const trainWithDocuments = async () => {
        const key = localStorage.getItem('apiKey');
        if (isEmpty(key)) {
            notification.warning({
                message: "OpenAI API Key",
                description: "Please input OpenAI API key.",
                duration: 2
            });
            return ;
        }

        const data = pdfList.map((item) => {
            return {
                filename: item.name.replace(' ', '')
            }
        });
        setLoading(true);
        const res = await fetch('/api/train', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: data,
                settings: {
                    chunkSize: settings.chunkSize
                },
                namespace: namespace,
                key: key
            }),
        })

        if (!res.ok) {
            notification.error({
                message: "Error",
                description: "OpenAI Embedding Error",
                duration: 2
            })
            setLoading(false)
            return ;
        }

        const data1 = res.body

        if (!data1) {
            notification.error({
                message: "Error",
                description: "OpenAI Embedding Error",
                duration: 2
            })
            setLoading(false)
            return ;
        }

        const reader = data1.getReader()
        const decoder = new TextDecoder()
        let done = false

        while (!done) {
            const { value, done: doneReading } = await reader.read()
            done = doneReading
            const chunkValue = decoder.decode(value)
            if (!chunkValue.includes('[DONE]')) {
                let percent: number = +chunkValue
            } else {
                setLoading(false);
                notification.success({
                    message: "Success",
                    description: "Embed Success",
                    duration: 2
                });
                return ;
            }
        }
    }

    useEffect(() => {
        form.setFieldsValue({
            chunkSize: settings.chunkSize,
            temperature: settings.temperature,
            maxTokenLength: settings.maxTokenLength,
            topp: settings.topp
        });
        if ((settings.avatar)) {
            setImageList([settings.avatar])
        }
    }, [showSettingPage]);

    const props = {
        name: 'file',
        multiple: true,
        action: '/api/files',
        onChange: function (info: UploadChangeParam<UploadFile<any>>) {
            setPdfList(info.fileList);
        },
        pdfList,
        beforeUpload: async (info: UploadFile) => {
            if (info.type !== "application/pdf") {
                notification.warning({
                    message: "Warning",
                    description: "Please upload PDF files",
                    duration: 2
                });
                return Upload.LIST_IGNORE;
            }
            try {
                setLoading(true);
                const params = {
                    Bucket: bucketName,
                    Key: pdfPath + info.name.replace(' ', ''),
                    Body: info,
                };
                const upload = s3.upload(params);
                upload.on('httpUploadProgress', (p) => {
                    console.log(p.loaded / p.total);
                    if (p.loaded / p.total !== 1 && !loading) {
                        setLoading(true);
                    }
                    if (p.loaded / p.total === 1) {
                        setLoading(false);
                    }
                });
                await upload.promise();
                console.log(`File uploaded successfully: ${info.name}`);
                notification.success({
                    message: "Success",
                    description: 'Files were uploaded successfully',
                    duration: 2
                })
                return false;
            } catch (err) {
                notification.error({
                    message: "Error",
                    description: 'Upload Error',
                    duration: 2
                })
                setLoading(false);
                return Upload.LIST_IGNORE;
            }
        }
    }

        return (
            <div className="relative flex-1 overflow-auto bg-white dark:bg-[#343541]">
                {
                    loading ? 
                        <div className='absolute w-full h-full flex flex-col justify-center dark:white items-center z-10'>
                            <Spin tip="Please wait..." size='large' className='spin-style' spinning={loading}></Spin>
                        </div> : 
                        <></>
                }
                <div className={loading ? 'opacity-50' : ''}>
                    <button
                        className='flex cursor-pointer items-center ml-16 mt-8 py-3 pl-2 pr-4 rounded-lg text-[14px] leading-3 text-black dark:text-white transition-colors duration-200 hover:bg-gray-500/10'
                        onClick={() => onToChatPage(false)}
                    >
                        <IconArrowLeft className='mr-2' />Back
                    </button>
                    <div className='flex justify-center pt-2'>
                        <div className='lg:w-[500px] md:w-[300px] form-setting'>
                            <div className='text-center text-4xl font-bold text-black dark:text-white mb-8'>Settings</div>
                            <Upload
                                name="avatar"
                                accept='image/*'
                                listType="picture-circle"
                                className="avatar-uploader mb-2"
                                action='/api/files'
                                fileList={imageList}
                                onChange={handleChange}
                                beforeUpload={handlebeforeUpload}
                                maxCount={1}
                            >
                                {uploadButton}
                            </Upload>
                            <Divider className='text-black dark:text-white border-black dark:border-slate-400'>Chat Settings</Divider>
                            <Form
                                form={form}
                                labelCol={{span: 10}}
                                wrapperCol={{span: 14}}
                                initialValues={{ remember: true }}
                                onFinish={onFinish}
                            >
                            <Form.Item
                                label="Chunk Size"
                                name="chunkSize"
                                initialValue={1000}
                                rules={[{ required: true, message: 'Please enter chunk size!' }]}
                            >
                                <InputNumber className='w-full bg-white py-1 dark:bg-[#343541] text-black dark:text-white' max={chunkSize.max} min={chunkSize.min} />
                            </Form.Item>
                            <Form.Item
                                label="Temperature"
                                name="temperature"
                                initialValue={1}
                                rules={[{ required: true, message: 'Please enter temperature!' }]}
                            >
                                <InputNumber className='w-full bg-white py-1 dark:bg-[#343541] text-black dark:text-white' step={0.001} max={temperature.max} min={temperature.min} />
                            </Form.Item>
                            <Form.Item
                                label="Max Token"
                                name="maxTokenLength"
                                initialValue={1000}
                                rules={[{ required: true, message: 'Please enter Max Token Length!' }]}
                            >
                                <InputNumber className='w-full bg-white py-1 dark:bg-[#343541] text-black dark:text-white' max={maxTokenLength.max} min={maxTokenLength.min} />
                            </Form.Item>
                            <Form.Item
                                label="Top P"
                                name="topp"
                                initialValue={1}
                                rules={[{ required: true, message: 'Please enter Top P!' }]}
                            >
                                <InputNumber className='w-full bg-white py-1 dark:bg-[#343541] text-black dark:text-white' step={0.001} max={topp.max} min={topp.min} />
                            </Form.Item>
                            <Divider className='text-black dark:text-white border-black dark:border-slate-400'>Train Data</Divider>
                            <Form.Item
                                label="Documents"
                                name='file'
                                rules={[{ required: true }]}
                                initialValue='PDF'
                            >
                                <Dragger
                                    {...props}
                                    accept="application/pdf"
                                    maxCount={5}
                                >
                                    <p className="ant-upload-drag-icon">
                                        <InboxOutlined />
                                    </p>
                                    <p className="ant-upload-text">Click or drag file to this area to upload</p>
                                    <p className="ant-upload-hint">Maximum size: 100MB</p>
                                    <p className="ant-upload-hint">Maximum count: 5</p>
                                </Dragger>
                                <div className='mt-4 flex justify-end'>
                                    <Button size='large' disabled={pdfList.length === 0} onClick={() => trainWithDocuments()}>Train</Button>
                                </div>
                            </Form.Item>
                            <Form.Item noStyle>
                                <div className='flex justify-evenly pl-8 pt-8 pb-20'>
                                <Button htmlType='submit' size='large'>Save</Button>
                                <Button onClick={() => onToChatPage(false)} size='large'>Back</Button>
                                </div>
                            </Form.Item>
                            </Form>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);
Settings.displayName = 'Settings';
