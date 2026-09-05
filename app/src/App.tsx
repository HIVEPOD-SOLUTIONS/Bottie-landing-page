import { useEffect, useState } from 'react'
import './App.css'
import './landing-redesign.css'
import { useNotificationHelpers } from './contexts/NotificationContext'
import { NotificationButton } from './components/NotificationButton'
import { NotificationToasts } from './components/NotificationCenter'
import { IPPortfolio } from './components/IPPortfolio'
import './components/IPPortfolio.css'

import {
  defineChain,
  getContract,
  prepareContractCall,
  readContract,
  sendTransaction,
  ThirdwebClient,
  waitForReceipt,
} from 'thirdweb'
import { ConnectButton, useActiveAccount } from 'thirdweb/react'
import { createWallet, inAppWallet } from 'thirdweb/wallets'
import { parseEther, formatEther } from 'viem'
import CONTRACT_ADDRESS_JSON from './deployed_addresses.json'

// Type assertion to include the ModredIP contract address
type ContractAddresses = {
  'ModredIPModule#ERC6551Account': string
  'ModredIPModule#ERC6551Registry': string
  'ModredIPModule#ModredIP': string
}

const CONTRACT_ADDRESSES = CONTRACT_ADDRESS_JSON as ContractAddresses

// BNB Smart Chain — BSC Testnet (Chapel, chain ID 97)
const bnbChain = {
  id: 97,
  name: 'BNB Smart Chain Testnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    },
    public: {
      http: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BscScan',
      url: 'https://testnet.bscscan.com',
    },
  },
  testnet: true,
}

// Backend API configuration
const BACKEND_URL = 'http://localhost:5000'

// File validation and preview utilities
const MAX_FILE_SIZE_MB = 50 // Maximum file size in megabytes
const ALLOWED_FILE_TYPES = [
  'application/pdf', // PDF
  'application/msword', // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain', // TXT
  'image/jpeg', // JPG/JPEG
  'image/png', // PNG
  'image/gif', // GIF
  'audio/mpeg', // MP3
  'audio/wav', // WAV
  'video/mp4', // MP4
]

// File validation function
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024)
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
    }
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type',
    }
  }

  return { valid: true }
}

// File preview generator
const generateFilePreview = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    }
    // Preview for PDFs (basic)
    else if (file.type === 'application/pdf') {
      resolve('📄 PDF Document')
    }
    // Preview for text files
    else if (file.type === 'text/plain') {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsText(file)
    }
    // Preview for other file types
    else {
      resolve(null)
    }
  })
}

// Remove hardcoded Pinata credentials
const PINATA_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJmZDYzMDVmZS1kMjNjLTQ4OGEtOGE1Zi1kMmQ4YjMzNjZiNGUiLCJlbWFpbCI6ImFmb2xhYmlpZmVvbHV3YTg5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJhZjRlYTllNzVkYjJmMDBlNDAwNyIsInNjb3BlZEtleVNlY3JldCI6ImQzMDZkNjZmOWI3ODlhYzIyNTY5YTY5NTY4YTNlNGNiNDExMDgzZjkyY2ZmNzg5NmY2MjU1Y2VjNmY1MzEzNjYiLCJleHAiOjE3OTgzMDkwNjd9.jCTgzS_Ygop0pniQNNhcN_ARaqu16JgXv-PJRyQCxxk'

/**
 * Uploads a file to IPFS via Pinata
 * @param file The file to upload
 * @returns Object with success status, CID and message
 */
const pinFileToIPFS = async (
  file: File,
): Promise<{
  success: boolean
  cid?: string
  message?: string
}> => {
  try {
    // Validate JWT is present
    if (!PINATA_JWT) {
      throw new Error(
        'Pinata JWT is not configured. Please set VITE_PINATA_JWT in your environment.',
      )
    }

    // Create form data
    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = {
      name: file.name,
      description: `Uploaded via Lobos frontend`,
      attributes: {
        uploadedBy: 'Lobos',
        timestamp: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size,
      },
    }
    formData.append('pinataMetadata', JSON.stringify(metadata))

    // Make request to Pinata
    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Pinata API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(
        `Pinata upload failed: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const result = await response.json()
    console.log('Pinata upload successful:', result)

    return {
      success: true,
      cid: result.IpfsHash,
      message: 'File uploaded successfully to IPFS',
    }
  } catch (error) {
    console.error('Error uploading to IPFS:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Converts an IPFS URL to a gateway URL for better compatibility
 * @param url IPFS URL (ipfs://, /ipfs/, or already a gateway URL)
 * @returns Gateway URL
 */
const getIPFSGatewayURL = (url: string): string => {
  if (!url) return ''

  // Use preferred gateway
  const gateway = 'https://gateway.pinata.cloud'

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '')
    return `${gateway}/ipfs/${cid}`
  }

  // Handle /ipfs/ path
  if (url.includes('/ipfs/')) {
    const parts = url.split('/ipfs/')
    if (parts.length > 1) {
      return `${gateway}/ipfs/${parts[1]}`
    }
  }

  // If it's already a gateway URL or something else, return as is
  return url
}

// Parse metadata to extract name and description
const parseMetadata = async (metadataUri: string) => {
  try {
    // If metadata is a direct JSON string, parse it
    if (metadataUri.startsWith('{')) {
      return JSON.parse(metadataUri)
    }

    // If it's an IPFS URI, fetch it
    if (metadataUri.startsWith('ipfs://')) {
      const gatewayUrl = getIPFSGatewayURL(metadataUri)
      const response = await fetch(gatewayUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }

      const metadata = await response.json()
      return metadata
    }

    // If it's already a gateway URL, fetch it
    if (metadataUri.includes('gateway.pinata.cloud')) {
      const response = await fetch(metadataUri)

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }

      const metadata = await response.json()
      return metadata
    }

    // Default fallback
    return {
      name: 'Unknown',
      description: 'No description available',
    }
  } catch (error) {
    console.error('Error parsing metadata:', error)
    return {
      name: 'Unknown',
      description: 'No description available',
    }
  }
}

const wallets = [
  inAppWallet({
    auth: {
      options: ['google', 'email', 'passkey', 'phone'],
    },
  }),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('io.rabby'),
  createWallet('com.trustwallet.app'),
  createWallet('global.safe'),
]

// ModredIP contract ABI (simplified for the functions we need)
const MODRED_IP_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getIPAsset',
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'ipHash', type: 'string' },
      { name: 'metadata', type: 'string' },
      { name: 'isEncrypted', type: 'bool' },
      { name: 'isDisputed', type: 'bool' },
      { name: 'registrationDate', type: 'uint256' },
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'royaltyTokens', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'licenseId', type: 'uint256' }],
    name: 'getLicense',
    outputs: [
      { name: 'licensee', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'royaltyPercentage', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'startDate', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'commercialUse', type: 'bool' },
      { name: 'terms', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'claimant', type: 'address' },
    ],
    name: 'getRoyaltyInfo',
    outputs: [
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'claimableAmount', type: 'uint256' },
      { name: 'lastClaimed', type: 'uint256' },
      { name: 'totalAccumulated', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTokenId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextLicenseId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'ipHash', type: 'string' },
      { name: 'metadata', type: 'string' },
      { name: 'isEncrypted', type: 'bool' },
    ],
    name: 'registerIP',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'royaltyPercentage', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'commercialUse', type: 'bool' },
      { name: 'terms', type: 'string' },
    ],
    name: 'mintLicense',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'payRevenue',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'claimRoyalties',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    name: 'raiseDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'registerArbitrator',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'selectedArbitrators', type: 'address[]' },
    ],
    name: 'assignArbitrators',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'decision', type: 'bool' },
      { name: 'resolution', type: 'string' },
    ],
    name: 'submitArbitrationDecision',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'checkAndResolveArbitration',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'resolveArbitrationAfterDeadline',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'resolveDisputeWithoutArbitrators',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getTokenDisputes',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'hasActiveDisputes',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    name: 'transferIP',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'getDispute',
    outputs: [
      { name: 'disputeId_', type: 'uint256' },
      { name: 'tokenId_', type: 'uint256' },
      { name: 'disputer_', type: 'address' },
      { name: 'reason_', type: 'string' },
      { name: 'timestamp_', type: 'uint256' },
      { name: 'isResolved_', type: 'bool' },
      { name: 'arbitrationId_', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'arbitrationId', type: 'uint256' }],
    name: 'getArbitration',
    outputs: [
      { name: 'arbitrationId_', type: 'uint256' },
      { name: 'disputeId_', type: 'uint256' },
      { name: 'arbitrators_', type: 'address[]' },
      { name: 'votesFor_', type: 'uint256' },
      { name: 'votesAgainst_', type: 'uint256' },
      { name: 'deadline_', type: 'uint256' },
      { name: 'isResolved_', type: 'bool' },
      { name: 'resolution_', type: 'string' },
      { name: 'threeUpholdVotesTimestamp_', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'arbitrator', type: 'address' }],
    name: 'getArbitratorActiveDisputes',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'arbitrator', type: 'address' }],
    name: 'getArbitrator',
    outputs: [
      { name: 'arbitrator_', type: 'address' },
      { name: 'stake_', type: 'uint256' },
      { name: 'reputation_', type: 'uint256' },
      { name: 'totalCases_', type: 'uint256' },
      { name: 'successfulCases_', type: 'uint256' },
      { name: 'isActive_', type: 'bool' },
      { name: 'registrationDate_', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllArbitrators',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_ARBITRATOR_STAKE',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'REQUIRED_ARBITRATORS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveArbitratorsCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextDisputeId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface IPAsset {
  owner: string
  ipHash: string
  metadata: string
  isEncrypted: boolean
  isDisputed: boolean
  registrationDate: bigint
  totalRevenue: bigint
  royaltyTokens: bigint
}

interface License {
  licensee: string
  tokenId: bigint
  royaltyPercentage: bigint
  duration: bigint
  startDate: bigint
  isActive: boolean
  commercialUse: boolean
  terms: string
}

interface AppProps {
  thirdwebClient: ThirdwebClient
}

// License Template Interface
interface LicenseTemplate {
  id: string
  name: string
  description: string
  icon: string
  royaltyPercentage: number
  duration: number // in seconds
  commercialUse: boolean
  commercialAttribution: boolean
  derivativesAllowed: boolean
  derivativesAttribution: boolean
  derivativesApproval: boolean
  derivativesReciprocal: boolean
  commercialRevShare: number // in basis points (100000000 = 100%)
  commercialRevCeiling: number
  derivativeRevCeiling: number
  commercializerChecker: string
  commercializerCheckerData: string
  currency: string
}

// Predefined License Templates
const LICENSE_TEMPLATES: LicenseTemplate[] = [
  {
    id: 'commercial',
    name: 'Commercial License',
    description:
      'Full commercial rights with attribution. Allows commercial use, derivatives, and sharing.',
    icon: '💼',
    royaltyPercentage: 15,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 100000000, // 100%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'non-commercial',
    name: 'Non-Commercial License',
    description:
      'Non-commercial use only. Allows derivatives and sharing, but no commercial use.',
    icon: '🚫',
    royaltyPercentage: 10,
    duration: 31536000, // 1 year
    commercialUse: false,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'cc-by',
    name: 'Creative Commons BY',
    description:
      'Attribution required. Allows commercial use, derivatives, and sharing with credit.',
    icon: '📝',
    royaltyPercentage: 5,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 50000000, // 50%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'cc-by-nc',
    name: 'Creative Commons BY-NC',
    description:
      'Attribution required, non-commercial only. No commercial use, but allows derivatives and sharing.',
    icon: '🎨',
    royaltyPercentage: 5,
    duration: 31536000, // 1 year
    commercialUse: false,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'cc-by-sa',
    name: 'Creative Commons BY-SA',
    description:
      'Attribution-ShareAlike. Allows commercial use and derivatives, but derivatives must use same license.',
    icon: '🔗',
    royaltyPercentage: 10,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 75000000, // 75%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'all-rights',
    name: 'All Rights Reserved',
    description:
      'Strict license. No commercial use, no derivatives. Attribution required for any use.',
    icon: '🔒',
    royaltyPercentage: 20,
    duration: 31536000, // 1 year
    commercialUse: false,
    commercialAttribution: true,
    derivativesAllowed: false,
    derivativesAttribution: false,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'public-domain',
    name: 'Public Domain',
    description:
      'No restrictions. Free for commercial use, derivatives, and sharing. No attribution required.',
    icon: '🌍',
    royaltyPercentage: 0,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: false,
    derivativesAllowed: true,
    derivativesAttribution: false,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'exclusive',
    name: 'Exclusive Commercial',
    description:
      'Exclusive commercial license with high royalty. No derivatives, commercial use only with approval.',
    icon: '⭐',
    royaltyPercentage: 25,
    duration: 63072000, // 2 years
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: false,
    derivativesAttribution: false,
    derivativesApproval: true,
    derivativesReciprocal: false,
    commercialRevShare: 100000000, // 100%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'custom',
    name: 'Custom License',
    description:
      'Manually configure all license parameters to your specific needs.',
    icon: '⚙️',
    royaltyPercentage: 10,
    duration: 86400, // 1 day default
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 100000000, // 100%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
]

// Tally waitlist embed — uses useEffect to call loadEmbeds() after mount,
// which is required in SPAs where the Tally script has already executed.
declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void }
  }
}

const TallyEmbed: React.FC = () => {
  useEffect(() => {
    if (typeof window.Tally !== 'undefined') {
      window.Tally.loadEmbeds()
    }
  }, [])

  return (
    <iframe
      data-tally-src="https://tally.so/embed/obzra5?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
      loading="lazy"
      width="100%"
      height="387"
      frameBorder="0"
      marginHeight={0}
      marginWidth={0}
      title="Bluvfi Waitlist"
      style={{ maxWidth: '520px', display: 'block' }}
    />
  )
}

// ── Privacy Policy Page ─────────────────────────────────────────────────────
const PrivacyPolicyPage: React.FC = () => {
  const sections = [
    { num: '01', id: 's1', title: 'Introduction' },
    { num: '02', id: 's2', title: 'Information We Collect' },
    { num: '03', id: 's3', title: 'How We Use Your Information' },
    { num: '04', id: 's4', title: 'Legal Basis for Processing' },
    { num: '05', id: 's5', title: 'How We Share Your Information' },
    { num: '06', id: 's6', title: 'Data Security' },
    { num: '07', id: 's7', title: 'Data Retention' },
    { num: '08', id: 's8', title: 'Your Privacy Rights' },
    { num: '09', id: 's9', title: 'Cookies & Tracking' },
    { num: '10', id: 's10', title: 'International Data Transfers' },
    { num: '11', id: 's11', title: 'Children\'s Privacy' },
    { num: '12', id: 's12', title: 'Third-Party Services' },
    { num: '13', id: 's13', title: 'Blockchain Transparency' },
    { num: '14', id: 's14', title: 'Changes to This Policy' },
    { num: '15', id: 's15', title: 'Contact Us' },
  ]

  return (
    <div className="pp-page">
      {/* ── Sticky Nav ── */}
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <a href="/" className="Bluvfi-brand pp-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
            <span>Bluvfi</span>
          </a>
          <a href="/" className="pp-back">← Back to home</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="pp-hero">
        <span className="pp-pill">Legal</span>
        <h1 className="pp-h1">Privacy <span className="pp-accent">Policy</span></h1>
        <p className="pp-meta">
          <strong>Last updated: August 27, 2026</strong>
          &nbsp;·&nbsp;Effective for all users of Bluvfi services.
        </p>
      </header>

      {/* ── Table of Contents ── */}
      <div className="pp-toc-wrap">
        <div className="pp-toc">
          <p className="pp-toc-label">Contents</p>
          <ol className="pp-toc-list">
            {sections.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.num}. {s.title}</a>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Sections ── */}
      <main className="pp-content">

        {/* 01 */}
        <section className="pp-section" id="s1">
          <div className="pp-section-head">
            <span className="pp-num">01</span>
            <h2>Introduction</h2>
          </div>
          <p>Bluvfi ("Bluvfi," "we," "us," or "our") is an AI-powered financial assistant that enables users to pay bills, manage subscriptions, and invest — all through a single, gasless on-chain payment flow. We are committed to protecting your privacy and handling your personal information responsibly.</p>
          <p>This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application, APIs, AI chat interface, and related services (collectively, the "Service").</p>
          <div className="pp-highlight">
            <p>By accessing or using the Service, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and disclosure of your information as described herein. If you do not agree, please do not use the Service.</p>
          </div>
          <p>This Privacy Policy is designed to comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws in the jurisdictions where we operate.</p>
        </section>

        {/* 02 */}
        <section className="pp-section" id="s2">
          <div className="pp-section-head">
            <span className="pp-num">02</span>
            <h2>Information We Collect</h2>
          </div>
          <h3 className="pp-h3">2.1 Information You Provide Directly</h3>
          <p>We collect information you voluntarily provide when you:</p>
          <ul>
            <li>Register for an account or authenticate via Privy (email, social login, passkey, or phone)</li>
            <li>Connect or create an embedded crypto wallet</li>
            <li>Initiate a payment, subscription, or investment action</li>
            <li>Contact our support team or join our waitlist</li>
            <li>Interact with the AI chat interface or use voice commands</li>
          </ul>
          <p>This includes: email address, phone number, cryptocurrency wallet addresses (embedded EOA wallets), payment and transaction details, AI chat messages, voice transcriptions, and app preferences.</p>

          <h3 className="pp-h3">2.2 Information Automatically Collected</h3>
          <div className="pp-card-grid">
            {[
              { title: 'Device & Browser', body: 'IP address, browser type, OS, device identifiers, and mobile network info.' },
              { title: 'Usage Data', body: 'Pages viewed, features used, time on page, links clicked, and AI prompts entered.' },
              { title: 'Location Data', body: 'General geographic location inferred from IP address.' },
              { title: 'Transaction Data', body: 'USDC amounts, wallet addresses, timestamps, supported mainnet networks, and Circle Gateway records.' },
              { title: 'Voice Data', body: 'Audio transcribed by OpenAI Whisper for voice-command features. Audio is not stored beyond transcription.' },
              { title: 'Cookies & Tracking', body: 'Information collected via cookies and similar technologies (see Section 9).' },
            ].map(c => (
              <div className="pp-card" key={c.title}>
                <strong>{c.title}</strong>
                <span>{c.body}</span>
              </div>
            ))}
          </div>

          <h3 className="pp-h3">2.3 Information from Third Parties</h3>
          <p>We may receive information from trusted partners including:</p>
          <ul>
            <li><strong>Privy</strong> — identity and wallet management, authentication, and embedded EOA creation</li>
            <li><strong>Circle</strong> — USDC payment processing, Arc AppKit transaction records, and Circle Gateway x402 settlements</li>
            <li><strong>OpenAI</strong> — AI chat processing (GPT-4o mini) and voice transcription (Whisper)</li>
            <li><strong>Vercel</strong> — hosting, analytics, and edge function logs</li>
            <li><strong>Neon / Drizzle ORM</strong> — payment history storage via Postgres</li>
            <li><strong>Alchemy</strong> — blockchain RPC and node infrastructure</li>
          </ul>
        </section>

        {/* 03 */}
        <section className="pp-section" id="s3">
          <div className="pp-section-head">
            <span className="pp-num">03</span>
            <h2>How We Use Your Information</h2>
          </div>
          <h3 className="pp-h3">3.1 Service Provision</h3>
          <ul>
            <li>Create and manage your account and embedded wallet</li>
            <li>Process gasless USDC payments, subscriptions, and investment purchases</li>
            <li>Operate the AI financial assistant and process natural language commands</li>
            <li>Display your bill catalog, portfolio, and payment history</li>
            <li>Send transaction confirmations and in-app notifications</li>
          </ul>
          <h3 className="pp-h3">3.2 Security and Compliance</h3>
          <ul>
            <li>Detect, prevent, and address fraud and unauthorized transactions</li>
            <li>Enforce our Terms of Service and usage policies</li>
            <li>Respond to legal processes and regulatory requirements</li>
            <li>Maintain audit logs for financial transactions</li>
          </ul>
          <h3 className="pp-h3">3.3 Analytics and Improvement</h3>
          <ul>
            <li>Analyze usage patterns and improve the AI assistant's accuracy</li>
            <li>Conduct research, A/B testing, and feature development</li>
            <li>Monitor service performance and reliability</li>
          </ul>
          <h3 className="pp-h3">3.4 Communications and Marketing</h3>
          <ul>
            <li>Send product updates, waitlist announcements, and newsletters (with your consent)</li>
            <li>Respond to support inquiries and feedback</li>
            <li>Notify you of new features, billing reminders, or low-balance alerts</li>
          </ul>
        </section>

        {/* 04 */}
        <section className="pp-section" id="s4">
          <div className="pp-section-head">
            <span className="pp-num">04</span>
            <h2>Legal Basis for Processing (GDPR)</h2>
          </div>
          <p>If you are located in the European Economic Area (EEA), our legal basis for processing your personal information is:</p>
          <ul>
            <li><strong>Contract Performance</strong> — Processing necessary to provide the Service you signed up for.</li>
            <li><strong>Legal Obligation</strong> — Processing required to comply with applicable financial and data protection laws.</li>
            <li><strong>Legitimate Interests</strong> — Fraud prevention, service security, analytics, and improving AI performance where these interests are not overridden by your rights.</li>
            <li><strong>Consent</strong> — Marketing communications and non-essential cookies, where you have provided explicit consent.</li>
          </ul>
        </section>

        {/* 05 */}
        <section className="pp-section" id="s5">
          <div className="pp-section-head">
            <span className="pp-num">05</span>
            <h2>How We Share Your Information</h2>
          </div>
          <div className="pp-highlight">
            <p><strong>We do not sell your personal information.</strong> We do not share your data with advertisers or data brokers.</p>
          </div>
          <h3 className="pp-h3">5.1 Service Providers</h3>
          <p>We share data with trusted third-party providers who help operate the Service — cloud hosting (Vercel), payment infrastructure (Circle, Privy), AI processing (OpenAI), database services (Neon), and analytics tools. All providers are contractually bound to protect your data.</p>
          <h3 className="pp-h3">5.2 Legal Requirements</h3>
          <p>We may disclose your information when required by law or in response to valid court orders, subpoenas, law enforcement requests, or regulatory authority demands.</p>
          <h3 className="pp-h3">5.3 Business Transfers</h3>
          <p>In connection with a merger, acquisition, or asset sale, your information may be transferred to the acquiring entity, subject to the same privacy commitments.</p>
          <h3 className="pp-h3">5.4 With Your Consent</h3>
          <p>We may share your information for purposes not described here only with your explicit prior consent.</p>
          <h3 className="pp-h3">5.5 Blockchain Transactions</h3>
          <p>All USDC transactions processed through Circle Gateway across our supported mainnet chains are visible on the public blockchain. This includes wallet addresses and transaction amounts. This data is immutable and cannot be erased once confirmed on-chain.</p>
        </section>

        {/* 06 */}
        <section className="pp-section" id="s6">
          <div className="pp-section-head">
            <span className="pp-num">06</span>
            <h2>Data Security</h2>
          </div>
          <p>We implement industry-standard security measures to protect your personal information:</p>
          <ul>
            <li>Data in transit encrypted with TLS 1.3</li>
            <li>Data at rest encrypted with AES-256</li>
            <li>Privy-managed embedded wallets — private keys are never exposed to Bluvfi servers</li>
            <li>Multi-factor authentication (MFA) available for all accounts</li>
            <li>Role-based access controls limiting internal data access</li>
            <li>Regular security reviews and dependency auditing</li>
            <li>Incident response and breach notification procedures</li>
          </ul>
          <div className="pp-info">
            <p>No method of transmission over the Internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security. You provide information at your own risk.</p>
          </div>
        </section>

        {/* 07 */}
        <section className="pp-section" id="s7">
          <div className="pp-section-head">
            <span className="pp-num">07</span>
            <h2>Data Retention</h2>
          </div>
          <p>We retain your personal information for as long as necessary to fulfill the purposes in this Privacy Policy, or as required by law:</p>
          <ul>
            <li><strong>Account Information</strong> — Duration of your account plus 7 years after closure (regulatory compliance)</li>
            <li><strong>Transaction Records</strong> — At least 7 years for financial and tax purposes</li>
            <li><strong>AI Chat Logs</strong> — Up to 90 days, then anonymized or deleted</li>
            <li><strong>Voice Transcriptions</strong> — Deleted immediately after processing; audio not retained</li>
            <li><strong>Marketing Data</strong> — Until you withdraw consent or we no longer have a legitimate need</li>
            <li><strong>Usage & Analytics Data</strong> — Up to 24 months</li>
          </ul>
          <p>After the retention period, we securely delete or anonymize your information.</p>
        </section>

        {/* 08 */}
        <section className="pp-section" id="s8">
          <div className="pp-section-head">
            <span className="pp-num">08</span>
            <h2>Your Privacy Rights</h2>
          </div>
          <h3 className="pp-h3">8.1 General Rights</h3>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul>
            <li><strong>Access</strong> — Request a copy of the personal information we hold about you</li>
            <li><strong>Correction</strong> — Request correction of inaccurate or incomplete data</li>
            <li><strong>Deletion</strong> — Request deletion of your data (subject to legal retention requirements)</li>
            <li><strong>Portability</strong> — Receive your data in a structured, machine-readable format</li>
            <li><strong>Objection</strong> — Object to processing based on legitimate interests</li>
            <li><strong>Restriction</strong> — Request restriction of processing in certain circumstances</li>
            <li><strong>Withdraw Consent</strong> — Withdraw consent for marketing or non-essential cookies at any time</li>
          </ul>
          <h3 className="pp-h3">8.2 GDPR Rights (EEA Residents)</h3>
          <p>If you are in the EEA, you also have the right to lodge a complaint with a supervisory authority in your member state.</p>
          <h3 className="pp-h3">8.3 Exercising Your Rights</h3>
          <p>To exercise any of your rights, contact us at <a href="mailto:hivepod@bluvfi.xyz" className="pp-link">hivepod@bluvfi.xyz</a>. We will respond within 30 days (or as required by applicable law).</p>
        </section>

        {/* 09 */}
        <section className="pp-section" id="s9">
          <div className="pp-section-head">
            <span className="pp-num">09</span>
            <h2>Cookies &amp; Tracking Technologies</h2>
          </div>
          <p>We use cookies and similar technologies to operate the Service and understand usage patterns:</p>
          <ul>
            <li><strong>Essential Cookies</strong> — Required for authentication, session management, and core functionality. Cannot be disabled.</li>
            <li><strong>Analytics Cookies</strong> — Used to understand how users interact with the Service (e.g., Vercel Analytics). You may opt out.</li>
            <li><strong>Preference Cookies</strong> — Store your UI preferences. Optional.</li>
          </ul>
          <p>You can control cookies through your browser settings. Disabling essential cookies may affect the functionality of the Service. We do not use advertising or third-party tracker cookies.</p>
        </section>

        {/* 10 */}
        <section className="pp-section" id="s10">
          <div className="pp-section-head">
            <span className="pp-num">10</span>
            <h2>International Data Transfers</h2>
          </div>
          <p>Your information may be transferred to and processed in countries other than your country of residence — including the United States, where many of our service providers (OpenAI, Vercel, Circle) are based.</p>
          <p>When transferring personal information from the EEA to countries outside the EEA, we rely on:</p>
          <ul>
            <li>Standard Contractual Clauses approved by the European Commission</li>
            <li>Adequacy decisions issued by the European Commission</li>
            <li>Other legally approved transfer mechanisms</li>
          </ul>
        </section>

        {/* 11 */}
        <section className="pp-section" id="s11">
          <div className="pp-section-head">
            <span className="pp-num">11</span>
            <h2>Children's Privacy</h2>
          </div>
          <p>The Service is not intended for individuals under the age of 18 (or the applicable age of majority in your jurisdiction). We do not knowingly collect personal information from children.</p>
          <p>If we become aware that we have inadvertently collected data from a child without verifiable parental consent, we will promptly delete that information. Please contact <a href="mailto:hivepod@bluvfi.xyz" className="pp-link">hivepod@bluvfi.xyz</a> if you believe this has occurred.</p>
        </section>

        {/* 12 */}
        <section className="pp-section" id="s12">
          <div className="pp-section-head">
            <span className="pp-num">12</span>
            <h2>Third-Party Services</h2>
          </div>
          <p>The Service integrates with third-party platforms not owned or controlled by Bluvfi. We are not responsible for their privacy practices. Key providers and their policies:</p>
          <ul>
            <li><strong>Privy</strong> — <a href="https://www.privy.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="pp-link">privy.io/privacy-policy</a></li>
            <li><strong>Circle / Arc AppKit</strong> — <a href="https://www.circle.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="pp-link">circle.com/legal/privacy-policy</a></li>
            <li><strong>OpenAI</strong> — <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="pp-link">openai.com/policies/privacy-policy</a></li>
            <li><strong>Vercel</strong> — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="pp-link">vercel.com/legal/privacy-policy</a></li>
          </ul>
        </section>

        {/* 13 */}
        <section className="pp-section" id="s13">
          <div className="pp-section-head">
            <span className="pp-num">13</span>
            <h2>Blockchain Transparency</h2>
          </div>
          <div className="pp-info">
            <p>Bluvfi is multichain and processes payments across supported mainnet networks. All on-chain transactions — including wallet addresses and USDC transfer amounts — are permanently recorded on a public blockchain and are visible to anyone worldwide. This data cannot be modified or deleted once confirmed. By using Bluvfi's payment features, you accept this inherent transparency.</p>
          </div>
          <p>We do not publish any off-chain personal information (such as your name or email) alongside your wallet address. However, if you publicly associate your identity with a wallet address elsewhere, those records may be linked by third parties.</p>
        </section>

        {/* 14 */}
        <section className="pp-section" id="s14">
          <div className="pp-section-head">
            <span className="pp-num">14</span>
            <h2>Changes to This Privacy Policy</h2>
          </div>
          <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. We will notify you of material changes by:</p>
          <ul>
            <li>Posting the updated Policy on this page with a new "Last Updated" date</li>
            <li>Sending an email notification to your registered address</li>
            <li>Displaying a prominent in-app notice</li>
          </ul>
          <p>Your continued use of the Service after the effective date constitutes your acceptance of the updated Privacy Policy.</p>
        </section>

        {/* 15 */}
        <section className="pp-section" id="s15">
          <div className="pp-section-head">
            <span className="pp-num">15</span>
            <h2>Contact Us</h2>
          </div>
          <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please reach out:</p>
          <div className="pp-contact-grid">
            {[
              { label: 'Privacy Requests', value: 'hivepod@bluvfi.xyz', href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'General Support', value: 'hivepod@bluvfi.xyz', href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'Follow Us on X', value: '@bluvfi', href: 'https://x.com/bluvfi' },
              { label: 'Telegram Community', value: 'Join our Telegram', href: 'https://t.me/+KXpDSUAnfg44MTg0' },
            ].map(c => (
              <div className="pp-contact-item" key={c.label}>
                <span className="pp-contact-label">{c.label}</span>
                <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="pp-link">{c.value}</a>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="pp-footer">
        <p>© 2026 Bluvfi. All rights reserved.</p>
        <div className="pp-footer-links">
          <a href="/">Home</a>
          <a href="/privacy" aria-current="page">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/aml">AML Policy</a>
          <a href="/cookies">Cookie Policy</a>
          <a href="https://x.com/bluvfi" target="_blank" rel="noopener noreferrer">X / Twitter</a>
          <a href="https://t.me/+KXpDSUAnfg44MTg0" target="_blank" rel="noopener noreferrer">Telegram</a>
        </div>
      </footer>
    </div>
  )
}

// ── Terms of Service Page ───────────────────────────────────────────────────
const TermsOfServicePage: React.FC = () => {
  const tocSections = [
    { num: '01', id: 't1',  title: 'Acceptance of Terms' },
    { num: '02', id: 't2',  title: 'Description of Service' },
    { num: '03', id: 't3',  title: 'Eligibility' },
    { num: '04', id: 't4',  title: 'User Accounts' },
    { num: '05', id: 't5',  title: 'Acceptable Use' },
    { num: '06', id: 't6',  title: 'Payments & Transactions' },
    { num: '07', id: 't7',  title: 'AI Features' },
    { num: '08', id: 't8',  title: 'Intellectual Property' },
    { num: '09', id: 't9',  title: 'Risk Disclosure' },
    { num: '10', id: 't10', title: 'Disclaimers' },
    { num: '11', id: 't11', title: 'Limitation of Liability' },
    { num: '12', id: 't12', title: 'Indemnification' },
    { num: '13', id: 't13', title: 'Privacy' },
    { num: '14', id: 't14', title: 'Termination' },
    { num: '15', id: 't15', title: 'Governing Law' },
    { num: '16', id: 't16', title: 'Changes to Terms' },
    { num: '17', id: 't17', title: 'Contact Us' },
  ]

  return (
    <div className="pp-page">
      {/* ── Sticky Nav ── */}
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <a href="/" className="Bluvfi-brand pp-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
            <span>Bluvfi</span>
          </a>
          <a href="/" className="pp-back">← Back to home</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="pp-hero">
        <span className="pp-pill">Legal</span>
        <h1 className="pp-h1">Terms of <span className="pp-accent">Service</span></h1>
        <p className="pp-meta">
          <strong>Last updated: August 27, 2026</strong>
          &nbsp;·&nbsp;Please read these terms carefully before using Bluvfi.
        </p>
      </header>

      {/* ── TOC ── */}
      <div className="pp-toc-wrap">
        <div className="pp-toc">
          <p className="pp-toc-label">Contents</p>
          <ol className="pp-toc-list">
            {tocSections.map(s => (
              <li key={s.id}><a href={`#${s.id}`}>{s.num}. {s.title}</a></li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Sections ── */}
      <main className="pp-content">

        {/* 01 */}
        <section className="pp-section" id="t1">
          <div className="pp-section-head"><span className="pp-num">01</span><h2>Acceptance of Terms</h2></div>
          <p>By accessing or using Bluvfi's website, web application, APIs, AI chat interface, or any related services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms") and our <a href="/privacy" className="pp-link">Privacy Policy</a>.</p>
          <div className="pp-highlight">
            <p><strong>If you do not agree to these Terms, you must not access or use the Service.</strong> Your continued use of the Service following any update to these Terms constitutes your acceptance of the revised Terms.</p>
          </div>
          <p>These Terms constitute a legally binding agreement between you ("User," "you," or "your") and Bluvfi ("Bluvfi," "we," "us," or "our"), operated under Hivepod Digital Solutions.</p>
        </section>

        {/* 02 */}
        <section className="pp-section" id="t2">
          <div className="pp-section-head"><span className="pp-num">02</span><h2>Description of Service</h2></div>
          <p>Bluvfi is a mobile-first AI financial assistant that enables users to:</p>
          <ul>
            <li>Pay bills and manage subscriptions (streaming, utilities, internet, cable)</li>
            <li>Buy and track investments (stocks, ETFs, pre-IPO opportunities)</li>
            <li>Send and receive USDC via gasless on-chain payments powered by Circle Arc AppKit and Circle Gateway x402</li>
            <li>Interact with an AI assistant (GPT-4o mini) using text or voice (OpenAI Whisper) to queue, confirm, and settle financial actions</li>
            <li>Manage an embedded cryptocurrency wallet provided by Privy</li>
          </ul>
          <div className="pp-info">
            <p>Bluvfi is currently in <strong>demo/beta</strong>. Features, limits, and supported assets may change. Real-money transactions on mainnet are subject to additional terms.</p>
          </div>
          <p>Bluvfi does not act as a bank, broker-dealer, investment adviser, or money transmitter. We are a technology platform that facilitates actions you explicitly confirm.</p>
        </section>

        {/* 03 */}
        <section className="pp-section" id="t3">
          <div className="pp-section-head"><span className="pp-num">03</span><h2>Eligibility</h2></div>
          <p>To use the Service you must:</p>
          <ul>
            <li>Be at least 18 years of age (or the age of legal majority in your jurisdiction)</li>
            <li>Have the legal capacity to enter into a binding agreement</li>
            <li>Not be located in, or a resident or national of, any country subject to applicable sanctions or trade restrictions</li>
            <li>Not be a person barred from using financial technology services under applicable law</li>
          </ul>
          <p>By using the Service, you represent and warrant that you meet all eligibility requirements. We reserve the right to refuse access to anyone who does not meet these criteria.</p>
        </section>

        {/* 04 */}
        <section className="pp-section" id="t4">
          <div className="pp-section-head"><span className="pp-num">04</span><h2>User Accounts</h2></div>
          <h3 className="pp-h3">4.1 Account Creation</h3>
          <p>Accounts are created and managed via <strong>Privy</strong>, which supports authentication by email, social login (Google), passkey, or phone number. By signing up, you agree to Privy's own terms and privacy policy in addition to ours.</p>
          <h3 className="pp-h3">4.2 Embedded Wallets</h3>
          <p>Privy creates a non-custodial embedded EOA (Externally Owned Account) wallet on your behalf. Bluvfi never has custody of, or access to, your private keys. You are solely responsible for the security of your authentication credentials.</p>
          <h3 className="pp-h3">4.3 Account Responsibility</h3>
          <ul>
            <li>You are responsible for all activity that occurs under your account</li>
            <li>You must notify us immediately of any unauthorized access at <a href="mailto:hivepod@bluvfi.xyz" className="pp-link">hivepod@bluvfi.xyz</a></li>
            <li>You may not share your account with or transfer it to any other person</li>
            <li>You may not create multiple accounts to circumvent any limitation or restriction</li>
          </ul>
          <h3 className="pp-h3">4.4 Account Accuracy</h3>
          <p>You agree to provide accurate, current, and complete information during registration and to keep this information up to date.</p>
        </section>

        {/* 05 */}
        <section className="pp-section" id="t5">
          <div className="pp-section-head"><span className="pp-num">05</span><h2>Acceptable Use</h2></div>
          <h3 className="pp-h3">5.1 Permitted Use</h3>
          <p>You may use the Service solely for lawful personal financial management purposes in accordance with these Terms.</p>
          <h3 className="pp-h3">5.2 Prohibited Activities</h3>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful, fraudulent, or unauthorized purpose</li>
            <li>Attempt to launder money, fund terrorism, or engage in any activity that violates AML/CFT laws</li>
            <li>Reverse-engineer, decompile, or attempt to extract source code from the Service</li>
            <li>Introduce viruses, malware, or other malicious code into the Service</li>
            <li>Use automated scripts, bots, or scraping tools against the Service without prior written consent</li>
            <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
            <li>Attempt to gain unauthorized access to any part of the Service or its related systems</li>
            <li>Use the AI assistant to generate content that is illegal, hateful, or harmful</li>
            <li>Circumvent any technical measures we use to limit access to the Service</li>
          </ul>
          <p>Violation of these provisions may result in immediate account termination and, where appropriate, referral to law enforcement.</p>
        </section>

        {/* 06 */}
        <section className="pp-section" id="t6">
          <div className="pp-section-head"><span className="pp-num">06</span><h2>Payments &amp; Transactions</h2></div>
          <h3 className="pp-h3">6.1 Payment Infrastructure</h3>
          <p>All payments are processed using <strong>Circle Arc AppKit</strong> across our supported mainnet chains. Bluvfi is chain-agnostic — transactions use USDC as the payment currency and are settled via <strong>Circle Gateway x402 nanopayments</strong>. Gas fees are sponsored — you only need USDC.</p>
          <h3 className="pp-h3">6.2 Transaction Finality</h3>
          <div className="pp-highlight">
            <p><strong>Blockchain transactions are irreversible.</strong> Once a payment is confirmed on-chain, it cannot be cancelled, reversed, or refunded by Bluvfi. You are solely responsible for verifying all transaction details before confirming any action.</p>
          </div>
          <h3 className="pp-h3">6.3 User Confirmation</h3>
          <p>Every payment — whether initiated via the UI or through the AI assistant — requires your explicit confirmation before execution. Bluvfi will never execute a payment without presenting you with a confirmation step first.</p>
          <h3 className="pp-h3">6.4 Supported Assets</h3>
          <p>Bluvfi currently supports USDC on Base mainnet. Supported assets, chains, and networks may change as the platform evolves. We are not responsible for losses arising from unsupported asset transfers.</p>
          <h3 className="pp-h3">6.5 Fees</h3>
          <p>Bluvfi may charge platform fees on certain transactions. Any applicable fees will be disclosed at the time of the transaction. We reserve the right to introduce or modify fees with notice to users.</p>
          <h3 className="pp-h3">6.6 Third-Party Payment Providers</h3>
          <p>Payment processing is subject to Circle's and Privy's terms and conditions. Bluvfi is not liable for failures, delays, or errors attributable to these third-party services.</p>
        </section>

        {/* 07 */}
        <section className="pp-section" id="t7">
          <div className="pp-section-head"><span className="pp-num">07</span><h2>AI Features</h2></div>
          <h3 className="pp-h3">7.1 AI Assistant</h3>
          <p>The Bluvfi AI assistant is powered by <strong>OpenAI GPT-4o mini</strong> and can list bills, queue payments, suggest investments, check balances, and respond to natural language commands. All actions suggested by the AI still require your explicit confirmation before execution.</p>
          <h3 className="pp-h3">7.2 Voice Input</h3>
          <p>Voice commands are transcribed using <strong>OpenAI Whisper</strong>. Audio is processed in real time and is not stored beyond the duration of transcription. By using voice input, you consent to audio processing by OpenAI in accordance with their privacy policy.</p>
          <h3 className="pp-h3">7.3 AI Limitations</h3>
          <div className="pp-info">
            <p>The AI assistant may produce inaccurate, incomplete, or outdated information. <strong>Nothing the AI assistant says constitutes financial, investment, tax, or legal advice.</strong> You should consult a qualified professional before making financial decisions. Bluvfi is not liable for any losses resulting from reliance on AI-generated content.</p>
          </div>
          <h3 className="pp-h3">7.4 AI Usage Data</h3>
          <p>Chat messages and voice transcriptions may be used to improve the Service, subject to our <a href="/privacy" className="pp-link">Privacy Policy</a>. You must not input personal data of third parties, confidential information, or sensitive financial credentials into the AI chat.</p>
        </section>

        {/* 08 */}
        <section className="pp-section" id="t8">
          <div className="pp-section-head"><span className="pp-num">08</span><h2>Intellectual Property</h2></div>
          <h3 className="pp-h3">8.1 Bluvfi's Property</h3>
          <p>The Service, including all software, code, design, text, graphics, logos, and AI models (excluding third-party components), is owned by or licensed to Bluvfi and is protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.</p>
          <h3 className="pp-h3">8.2 Your Content</h3>
          <p>You retain ownership of any content you submit to the Service (such as AI prompts or uploaded data). By submitting content, you grant Bluvfi a non-exclusive, worldwide, royalty-free licence to use, process, and store that content solely to provide and improve the Service.</p>
          <h3 className="pp-h3">8.3 Feedback</h3>
          <p>If you provide suggestions, feedback, or ideas about the Service, you grant Bluvfi an irrevocable, royalty-free licence to use that feedback for any purpose without obligation or compensation to you.</p>
        </section>

        {/* 09 */}
        <section className="pp-section" id="t9">
          <div className="pp-section-head"><span className="pp-num">09</span><h2>Risk Disclosure</h2></div>
          <div className="pp-highlight">
            <p><strong>Cryptocurrency and digital asset activities involve substantial risk.</strong> You should not use funds you cannot afford to lose.</p>
          </div>
          <p>Specific risks include but are not limited to:</p>
          <div className="pp-card-grid">
            {[
              { title: 'Market Volatility', body: 'Cryptocurrency and asset prices are highly volatile and can change dramatically in a short time.' },
              { title: 'Smart Contract Risk', body: 'Smart contracts may contain bugs or vulnerabilities that could result in loss of funds.' },
              { title: 'Regulatory Risk', body: 'Laws governing crypto assets vary by jurisdiction and may change, affecting the availability or legality of the Service.' },
              { title: 'Network Risk', body: 'Blockchain networks may experience congestion, forks, or downtime that affect transaction processing.' },
              { title: 'Wallet Security', body: 'Loss of access to your authentication credentials may result in permanent loss of access to your wallet and funds.' },
              { title: 'Third-Party Risk', body: 'Failures by Circle, Privy, OpenAI, or other service providers may impact the availability or functionality of Bluvfi.' },
            ].map(c => (
              <div className="pp-card" key={c.title}>
                <strong>{c.title}</strong>
                <span>{c.body}</span>
              </div>
            ))}
          </div>
          <p>By using the Service, you acknowledge and accept all such risks. Bluvfi is not responsible for any losses you incur as a result of these risks.</p>
        </section>

        {/* 10 */}
        <section className="pp-section" id="t10">
          <div className="pp-section-head"><span className="pp-num">10</span><h2>Disclaimers</h2></div>
          <div className="pp-info">
            <p>THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>
          </div>
          <p>Bluvfi does not warrant that:</p>
          <ul>
            <li>The Service will be uninterrupted, error-free, or secure at all times</li>
            <li>Any information provided by the AI assistant is accurate, complete, or current</li>
            <li>Defects in the Service will be corrected within any particular timeframe</li>
            <li>The Service or its servers are free of viruses or other harmful components</li>
          </ul>
          <p>Nothing in the Service constitutes financial advice, investment advice, trading advice, or any other sort of advice. You should conduct your own due diligence before making any financial decisions.</p>
        </section>

        {/* 11 */}
        <section className="pp-section" id="t11">
          <div className="pp-section-head"><span className="pp-num">11</span><h2>Limitation of Liability</h2></div>
          <p>To the maximum extent permitted by applicable law, Bluvfi and its officers, directors, employees, and affiliates shall not be liable for any:</p>
          <ul>
            <li>Indirect, incidental, special, consequential, or punitive damages</li>
            <li>Loss of profits, revenue, data, or goodwill</li>
            <li>Cost of substitute goods or services</li>
            <li>Damages arising from unauthorised access to or alteration of your transmissions or data</li>
            <li>Losses arising from blockchain transactions, including irreversible payments</li>
          </ul>
          <p>In no event shall Bluvfi's total liability to you for all claims exceed the greater of (a) the amount you paid to Bluvfi in the 12 months preceding the claim, or (b) USD $100.</p>
          <p>Some jurisdictions do not allow certain exclusions or limitations of liability, so the above may not fully apply to you.</p>
        </section>

        {/* 12 */}
        <section className="pp-section" id="t12">
          <div className="pp-section-head"><span className="pp-num">12</span><h2>Indemnification</h2></div>
          <p>You agree to indemnify, defend, and hold harmless Bluvfi and its officers, directors, employees, contractors, and affiliates from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in connection with:</p>
          <ul>
            <li>Your use of or access to the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights, including intellectual property or privacy rights</li>
            <li>Any content you submit to or through the Service</li>
            <li>Your violation of any applicable law or regulation</li>
          </ul>
        </section>

        {/* 13 */}
        <section className="pp-section" id="t13">
          <div className="pp-section-head"><span className="pp-num">13</span><h2>Privacy</h2></div>
          <p>Your use of the Service is also governed by our <a href="/privacy" className="pp-link">Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection, use, and disclosure of your information as described in the Privacy Policy.</p>
        </section>

        {/* 14 */}
        <section className="pp-section" id="t14">
          <div className="pp-section-head"><span className="pp-num">14</span><h2>Termination</h2></div>
          <h3 className="pp-h3">14.1 Termination by You</h3>
          <p>You may stop using the Service at any time. To request deletion of your account and associated data, contact <a href="mailto:hivepod@bluvfi.xyz" className="pp-link">hivepod@bluvfi.xyz</a>.</p>
          <h3 className="pp-h3">14.2 Termination by Bluvfi</h3>
          <p>We may suspend or terminate your access to the Service at any time, with or without notice, for any reason including but not limited to:</p>
          <ul>
            <li>Breach of these Terms</li>
            <li>Suspected fraudulent, abusive, or illegal activity</li>
            <li>Extended inactivity</li>
            <li>Discontinuation of the Service</li>
          </ul>
          <h3 className="pp-h3">14.3 Effect of Termination</h3>
          <p>Upon termination, your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination — including Intellectual Property, Risk Disclosure, Disclaimers, Limitation of Liability, and Indemnification — shall survive.</p>
        </section>

        {/* 15 */}
        <section className="pp-section" id="t15">
          <div className="pp-section-head"><span className="pp-num">15</span><h2>Governing Law</h2></div>
          <p>These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved through binding arbitration or in a court of competent jurisdiction, as determined by Bluvfi in its sole discretion.</p>
          <p>Nothing in these Terms limits your rights as a consumer under mandatory consumer protection laws in your jurisdiction.</p>
        </section>

        {/* 16 */}
        <section className="pp-section" id="t16">
          <div className="pp-section-head"><span className="pp-num">16</span><h2>Changes to Terms</h2></div>
          <p>We reserve the right to update these Terms at any time. We will notify you of material changes by:</p>
          <ul>
            <li>Posting the updated Terms on this page with a new "Last Updated" date</li>
            <li>Sending an email notification to your registered address</li>
            <li>Displaying a prominent in-app notice</li>
          </ul>
          <p>Your continued use of the Service after the effective date of updated Terms constitutes your acceptance of the changes. If you do not agree to the updated Terms, you must stop using the Service.</p>
        </section>

        {/* 17 */}
        <section className="pp-section" id="t17">
          <div className="pp-section-head"><span className="pp-num">17</span><h2>Contact Us</h2></div>
          <p>For questions about these Terms, to report a violation, or to request account deletion, reach out to us:</p>
          <div className="pp-contact-grid">
            {[
              { label: 'Legal & Terms',      value: 'hivepod@bluvfi.xyz',   href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'General Support',    value: 'hivepod@bluvfi.xyz', href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'Follow Us on X',     value: '@bluvfi',            href: 'https://x.com/bluvfi' },
              { label: 'Telegram Community', value: 'Join our Telegram',  href: 'https://t.me/+KXpDSUAnfg44MTg0' },
            ].map(c => (
              <div className="pp-contact-item" key={c.label}>
                <span className="pp-contact-label">{c.label}</span>
                <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="pp-link">{c.value}</a>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="pp-footer">
        <p>© 2026 Bluvfi. All rights reserved.</p>
        <div className="pp-footer-links">
          <a href="/">Home</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms" aria-current="page">Terms of Service</a>
          <a href="/aml">AML Policy</a>
          <a href="/cookies">Cookie Policy</a>
          <a href="https://x.com/bluvfi" target="_blank" rel="noopener noreferrer">X / Twitter</a>
          <a href="https://t.me/+KXpDSUAnfg44MTg0" target="_blank" rel="noopener noreferrer">Telegram</a>
        </div>
      </footer>
    </div>
  )
}

// ── AML Policy Page ─────────────────────────────────────────────────────────
const AMLPolicyPage: React.FC = () => {
  const tocSections = [
    { num: 'BG', id: 'a0',  title: 'Background Information' },
    { num: '01', id: 'a1',  title: 'Main Objectives' },
    { num: '02', id: 'a2',  title: 'General Principles' },
    { num: '03', id: 'a3',  title: 'Our Responsibilities' },
    { num: '04', id: 'a4',  title: 'Risk-Based Approach' },
    { num: '05', id: 'a5',  title: 'Indicators of Suspicious Activity' },
    { num: '06', id: 'a6',  title: 'Data Requests & KYC' },
    { num: '07', id: 'a7',  title: 'Restricted Activities & Clients' },
    { num: '08', id: 'a8',  title: 'Sanctions' },
    { num: '09', id: 'a9',  title: 'Non-Serviced Countries' },
    { num: '10', id: 'a10', title: 'Monitoring for Suspicious Activity' },
    { num: '11', id: 'a11', title: 'Contact Information' },
  ]

  const nonServicedCountries = [
    'Afghanistan', 'Belarus', 'Cuba',
    'Iran', 'Iraq', 'Libya',
    'Myanmar (Burma)', 'North Korea', 'Russia',
    'Somalia', 'South Sudan', 'Sudan', 'Syria',
    'Venezuela', 'Yemen',
    'Crimea (Region)', 'Donbas Regions (DNR/LNR)',
  ]

  return (
    <div className="pp-page">
      {/* ── Sticky Nav ── */}
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <a href="/" className="Bluvfi-brand pp-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
            <span>Bluvfi</span>
          </a>
          <a href="/" className="pp-back">← Back to home</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="pp-hero">
        <span className="pp-pill">Legal</span>
        <h1 className="pp-h1">AML <span className="pp-accent">Policy</span></h1>
        <p className="pp-meta">
          <strong>Last updated: August 27, 2026</strong>
          &nbsp;·&nbsp;Anti-Money Laundering &amp; Counter-Terrorism Financing Policy.
        </p>
      </header>

      {/* ── Intro statement ── */}
      <div className="pp-toc-wrap">
        <div className="pp-highlight" style={{ marginTop: 0 }}>
          <p>
            Bluvfi, operated under Hivepod Digital Solutions, is committed to maintaining effective crime prevention and detection measures to assist law enforcement agencies in combating financial crime. We have adopted a strict set of policies and procedures to fulfil our legal obligations under international anti-money laundering (AML) and anti-terrorism financing (CTF) legislation.
          </p>
        </div>
      </div>

      {/* ── TOC ── */}
      <div className="pp-toc-wrap" style={{ marginTop: '24px' }}>
        <div className="pp-toc">
          <p className="pp-toc-label">Contents</p>
          <ol className="pp-toc-list">
            {tocSections.map(s => (
              <li key={s.id}><a href={`#${s.id}`}>{s.num}. {s.title}</a></li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Sections ── */}
      <main className="pp-content">

        {/* Background */}
        <section className="pp-section" id="a0">
          <div className="pp-section-head"><span className="pp-num">BG</span><h2>Background Information</h2></div>
          <p>Money laundering is a process by which money and property obtained as a result of criminal activity are disguised as coming from a legitimate source. In essence, it is a process in which "dirty money" turns into "clean money" whose criminal origin is difficult to trace.</p>
          <p>There are three recognised stages in the money laundering process:</p>
          <div className="pp-card-grid">
            {[
              { title: 'Placement', body: 'Involves the placement of proceeds from crime into the financial system.' },
              { title: 'Layering', body: 'Involves the transformation of criminal proceeds through complex layers of financial transactions to hide their source and ownership.' },
              { title: 'Integration', body: 'Involves the return of laundered income to the economy to create an appearance of legitimacy.' },
            ].map(c => (
              <div className="pp-card" key={c.title}>
                <strong>{c.title}</strong>
                <span>{c.body}</span>
              </div>
            ))}
          </div>
          <p>Predicate offences include tax evasion, drug trafficking, bribery, fraud, forgery, murder, robbery, counterfeiting, securities manipulation, and copyright infringement, among others.</p>
          <div className="pp-info">
            <p><strong>Terrorist Financing</strong> occurs when you knowingly collect or provide property — such as funds — directly or indirectly to terrorists. Many techniques used in money laundering are also used in terrorist financing, including concealing the channelling of funds and the use of third parties.</p>
          </div>
        </section>

        {/* 01 */}
        <section className="pp-section" id="a1">
          <div className="pp-section-head"><span className="pp-num">01</span><h2>Main Objectives</h2></div>
          <p>Bluvfi's AML programme is designed to ensure that:</p>
          <ul>
            <li>Users' identities are satisfactorily verified in accordance with our risk-based approach before Bluvfi does business with them</li>
            <li>Bluvfi knows its users and understands their reasons for using the Service, both at onboarding and throughout the relationship</li>
            <li>All team members are trained and aware of both their personal legal obligations and Bluvfi's legal obligations</li>
            <li>Team members are trained to be vigilant for activities where there are reasonable grounds for suspicion that money laundering or terrorist financing could be taking place, and to report to the Compliance Officer</li>
            <li>Sufficient records are kept for the required period</li>
            <li>Appropriate procedures are established, maintained, and implemented to achieve these objectives</li>
          </ul>
        </section>

        {/* 02 */}
        <section className="pp-section" id="a2">
          <div className="pp-section-head"><span className="pp-num">02</span><h2>General Principles</h2></div>

          <h3 className="pp-h3">Anti-Money Laundering Policy</h3>
          <p>Bluvfi has implemented policies, procedures, and controls designed to prevent criminals from using our platform to launder the proceeds of crime. These policies and procedures are tailored to the risk posed by individual users and transaction types.</p>

          <h3 className="pp-h3">Customer Due Diligence (CDD)</h3>
          <p>Bluvfi has established customer due diligence procedures to identify users of its services and, in respect of higher-risk users, the primary beneficial owners and origin of funds. The CDD policy is designed to fulfil the following objectives:</p>
          <ul>
            <li>Identification and verification of the applicant for the Service</li>
            <li>Identification and verification of the beneficial owner, where applicable</li>
            <li>Identification and verification when the applicant does not act as principal</li>
            <li>Obtaining information on the purpose and intended nature of the business relationship</li>
            <li>Conducting ongoing monitoring of the business relationship</li>
            <li>Establishing the source of wealth and source of funds</li>
            <li>Setting up a user acceptance policy and ensuring that applicants meet the requirements</li>
          </ul>
          <div className="pp-highlight">
            <p>Bluvfi is strictly prohibited from keeping anonymous accounts or accounts in fictitious names.</p>
          </div>

          <h3 className="pp-h3">Suspicious Transactions</h3>
          <p>Unexplained or anomalous transactions or activities suspected to be related to criminal activity must be reported immediately in writing to the Compliance Officer, who will determine whether the suspicion should be escalated to Law Enforcement.</p>

          <h3 className="pp-h3">Training</h3>
          <p>All personnel are informed of their individual and collective AML responsibilities. Personnel receive training to understand the vulnerabilities of Bluvfi's business and to recognise and report suspicious activities.</p>

          <h3 className="pp-h3">Record-Keeping</h3>
          <p>Bluvfi keeps records of training completion. We retain all records confirming the identity of our users for at least 7 years after the end of the business relationship, and all internal reports of suspicion made to the Compliance Officer.</p>
        </section>

        {/* 03 */}
        <section className="pp-section" id="a3">
          <div className="pp-section-head"><span className="pp-num">03</span><h2>Our Responsibilities</h2></div>
          <p>As a cryptocurrency-adjacent financial technology platform, Bluvfi is committed to meeting the following obligations under applicable international law:</p>
          <ul>
            <li>Develop and maintain a programme to ensure compliance with reporting, record-keeping, and user identification requirements</li>
            <li>Comply with user identification rules and maintain specific records for specific transactions</li>
            <li>Report suspicious transactions, large unusual transactions, and information related to terrorist property to appropriate authorities</li>
            <li>Cooperate fully with regulatory bodies and law enforcement when required by law</li>
          </ul>
        </section>

        {/* 04 */}
        <section className="pp-section" id="a4">
          <div className="pp-section-head"><span className="pp-num">04</span><h2>Risk-Based Approach</h2></div>
          <p>Risk is defined as the likelihood of an event and its consequences. In the context of money laundering and terrorist financing (ML/TF), risk means:</p>
          <ul>
            <li><strong>At the national level:</strong> ML/TF threats and vulnerabilities that jeopardise the integrity of the financial system</li>
            <li><strong>At the platform level:</strong> Threats and vulnerabilities that put Bluvfi at risk of being used to facilitate ML/TF</li>
          </ul>

          <h3 className="pp-h3">Default Risk Classification</h3>
          <p>All users default to <strong>low risk</strong>, unless specific risk factors are present. Automatic high-risk characteristics include:</p>
          <ul>
            <li>Politically exposed person (PEP)</li>
            <li>A user where a suspicious transaction or terrorist financing report has been filed</li>
            <li>A user who is an identified terrorist or on a sanctions list</li>
            <li>A user for whom we are unable to obtain beneficial ownership information</li>
            <li>A user from a high-risk country (see Section 9)</li>
          </ul>

          <h3 className="pp-h3">Client &amp; Transaction Risk Factors</h3>
          <ul>
            <li>Politically exposed person, head of an international organisation, or close associate thereof</li>
            <li>Unknown or unclear source of funds</li>
            <li>Large transaction orders to/from high-risk foreign jurisdictions</li>
            <li>Third-party involvement without reasonable justification</li>
            <li>High-risk occupations (e.g., cash-intensive businesses, offshore business, online gambling)</li>
            <li>Unusually complex business structure or transaction patterns</li>
            <li>Non face-to-face user identification without justifiable reason</li>
          </ul>

          <h3 className="pp-h3">Geographic Risk Factors</h3>
          <ul>
            <li>User resides in a known high-crime area</li>
            <li>User has offshore business activities in high-risk jurisdictions</li>
            <li>User connections to countries with weak AML frameworks</li>
          </ul>

          <h3 className="pp-h3">Other Suspicious Transaction Indicators</h3>
          <ul>
            <li>Volume, timing, or complexity of transactions inconsistent with the user's personal or business activity</li>
            <li>Value of deposits or transfers inconsistent with stated occupation or source of funds</li>
            <li>Presence of any suspicious indicators outlined in Section 5</li>
          </ul>
        </section>

        {/* 05 */}
        <section className="pp-section" id="a5">
          <div className="pp-section-head"><span className="pp-num">05</span><h2>Indicators of Suspicious Activity</h2></div>
          <p>The following are examples of general and industry-specific indicators that may give reasonable grounds to suspect money laundering or terrorist financing. The presence of one or more factors does not automatically require a report, but it does indicate that a more in-depth examination is required.</p>

          <h3 className="pp-h3">General Indicators</h3>
          <ul>
            <li>User admits to or makes statements about involvement in criminal activities</li>
            <li>User refuses or tries to avoid providing required information, or provides information that is misleading, vague, or difficult to verify</li>
            <li>User produces seemingly false or altered documentation</li>
            <li>User appears to have accounts with several financial institutions for no apparent reason</li>
            <li>User repeatedly uses an address but frequently changes the name involved</li>
            <li>User shows uncommon curiosity about internal controls and monitoring systems</li>
            <li>User presents confusing or inconsistent details about transactions</li>
            <li>User makes inquiries indicating a desire to avoid regulatory reporting</li>
            <li>User is involved in unusual activity inconsistent with their profile</li>
            <li>User appears unusually familiar with money laundering or terrorist financing techniques</li>
            <li>User refuses to produce valid identification documents</li>
            <li>User frequently accesses or transacts from high-risk countries</li>
          </ul>

          <h3 className="pp-h3">Crypto-Specific Indicators</h3>
          <ul>
            <li>User requests USDC exchanges at rates that significantly exceed standard rates</li>
            <li>User wants to pay transaction fees that greatly exceed posted fees</li>
            <li>User exchanges large volumes of cryptocurrency without clear business justification</li>
            <li>User knows little about recipient wallet addresses and is reluctant to disclose details</li>
            <li>User enters into transactions with counterparties in locations unusual for their profile</li>
            <li>User instructs that funds be handled by a third party on behalf of the payee</li>
            <li>User makes large USDC purchases inconsistent with known financial activity</li>
            <li>User attempts to use the AI assistant to circumvent transaction monitoring or confirmations</li>
          </ul>
        </section>

        {/* 06 */}
        <section className="pp-section" id="a6">
          <div className="pp-section-head"><span className="pp-num">06</span><h2>Data Requests &amp; KYC</h2></div>
          <p>To mitigate the risks associated with money laundering and terrorist financing, Bluvfi requires that payments initiated through the platform correspond to legitimate, identifiable purposes — such as subscriptions, utility bills, merchant payments, and investment purchases. Bluvfi is designed to let users pay real-world services (e.g. Netflix, Spotify, utilities, stocks) using USDC through their linked wallet. Payments to merchants and service providers are permitted and are the core purpose of the platform. However, Bluvfi does not facilitate anonymous peer-to-peer transfers with no identifiable purpose, and reserves the right to review or restrict transactions that show signs of money laundering or terrorist financing.</p>
          <p>In accordance with our Know Your Customer (KYC) policy, authorised personnel may carry out user verification. In such cases, the user may be required to provide:</p>
          <ul>
            <li>Information about the services for which funds were received</li>
            <li>Documentation confirming the receipt and withdrawal of funds</li>
            <li>Source of wealth and source of funds documentation</li>
            <li>Government-issued identification or proof of address</li>
            <li>Any additional information reasonably requested by Bluvfi's Compliance team</li>
          </ul>
          <div className="pp-highlight">
            <p>Bluvfi reserves the right to refuse to process a transaction at any stage if it is suspected to involve money laundering or other criminal activity, without prior notice to the user.</p>
          </div>
        </section>

        {/* 07 */}
        <section className="pp-section" id="a7">
          <div className="pp-section-head"><span className="pp-num">07</span><h2>Restricted Activities &amp; Clients</h2></div>
          <p>To control ML/TF risk, Bluvfi does not provide services and will refuse or close accounts for users with the following characteristics:</p>

          <h3 className="pp-h3">Private Individuals</h3>
          <ul>
            <li>Negative information indicating possible relation to proceeds of crime, money laundering, or terrorism</li>
            <li>Funds previously frozen or arrested in connection with suspected criminal activity</li>
            <li>Attempting to avoid provision of information or hide economic activity</li>
            <li>Involvement in trafficking of arms and ammunition</li>
            <li>Unlicensed foreign currency exchange or other unlicensed investment services</li>
            <li>Organisation of escort services or distribution of illegal content</li>
            <li>Cash collection services or unlicensed debt recovery services</li>
            <li>Drug distribution and controlled substances</li>
            <li>Pyramid schemes and multi-level marketing</li>
            <li>Pawnshop services or illegal telemarketing</li>
          </ul>

          <h3 className="pp-h3">Legal Entities</h3>
          <ul>
            <li>Attempting to avoid provision of information or hide economic activity</li>
            <li>Negative information indicating possible relation to proceeds of crime or terrorism</li>
            <li>Funds previously frozen or arrested in connection with suspected criminal activity</li>
            <li>Unlicensed reinsurance services with lack of proper supervision</li>
            <li>Investment services without proper licensing</li>
            <li>Recognised shell companies with no clear economic purpose</li>
            <li>Unlicensed gambling services</li>
            <li>Unclear reason for establishment with vague economic objectives</li>
            <li>Transactions that are complex, unusually large, or unclear in legal and economic objective</li>
          </ul>

          <h3 className="pp-h3">Enhanced Due Diligence (EDD)</h3>
          <p>In accordance with internal AML/CFT procedures, Bluvfi classifies users into two risk categories: <strong>low-risk</strong> and <strong>high-risk</strong>. For high-risk users, Enhanced Due Diligence is carried out. A high-risk user is someone:</p>
          <ul>
            <li>Who is a politically exposed person, a family member, or a close associate of one</li>
            <li>With whom financial obligations or claims exceed $10,000 USD</li>
          </ul>
        </section>

        {/* 08 */}
        <section className="pp-section" id="a8">
          <div className="pp-section-head"><span className="pp-num">08</span><h2>Sanctions</h2></div>
          <p>Bluvfi is prohibited from transacting with individuals, companies, and countries that are on prescribed Sanctions lists. Bluvfi screens against the relevant sanctions lists in the jurisdictions in which it operates.</p>
          <p>Bluvfi has no AML Risk Appetite for establishing or maintaining a relationship with any natural person or legal entity designated on any of the below lists, or where otherwise prohibited by applicable law or regulation:</p>
          <ul>
            <li>Sanction lists administered by the <strong>United States Office of Foreign Assets Control (OFAC)</strong></li>
            <li>The <strong>United Nations Security Council Sanctions List (UN)</strong></li>
            <li>The <strong>Consolidated List of European Union Financial Sanctions (EU)</strong></li>
            <li>The <strong>List of Specially Designated Nationals and Blocked Persons</strong></li>
            <li>Any other applicable national or international sanctions lists</li>
          </ul>
          <div className="pp-info">
            <p>Bluvfi pays particular attention to entities from countries on the list of non-cooperative countries and territories drawn up by the <strong>Financial Action Task Force (FATF)</strong> and to monetary operations performed by or on behalf of them.</p>
          </div>
        </section>

        {/* 09 */}
        <section className="pp-section" id="a9">
          <div className="pp-section-head"><span className="pp-num">09</span><h2>Non-Serviced Countries</h2></div>
          <p>Bluvfi does not open accounts and does not provide services to users from the following countries and jurisdictions:</p>
          <div className="pp-card-grid">
            {nonServicedCountries.map(c => (
              <div className="pp-card" key={c} style={{ padding: '10px 14px' }}>
                <span style={{ color: 'rgba(238,252,245,0.85)', fontSize: '0.88rem' }}>{c}</span>
              </div>
            ))}
          </div>
          <div className="pp-highlight">
            <p><strong>Note:</strong> This list reflects countries under comprehensive sanctions as of <strong>August 2026</strong>, per <strong>OFAC</strong> (U.S. Office of Foreign Assets Control), the <strong>UN Security Council Sanctions List</strong>, and the <strong>EU Consolidated Financial Sanctions List</strong>. It does not include FATF grey-list countries that are not under full sanctions. Crimea and the Donbas regions (DNR/LNR) are sanctioned territories — the rest of Ukraine is not restricted. This list is reviewed regularly and is subject to change as sanctions regimes are updated.</p>
          </div>
        </section>

        {/* 10 */}
        <section className="pp-section" id="a10">
          <div className="pp-section-head"><span className="pp-num">10</span><h2>Monitoring for Suspicious Activity</h2></div>
          <p>Bluvfi's AML policy includes user and beneficial owner due diligence, ongoing transaction monitoring, and AML reporting policies. All USDC transactions processed through Circle Gateway across our supported mainnet chains are subject to ongoing monitoring.</p>
          <p>At various points in time, Bluvfi may request information regarding transactions carried out through a user's account and the parties to the respective payment.</p>
          <div className="pp-highlight">
            <p>If a user does not respond sufficiently or within a timely manner to an information request, Bluvfi reserves the right to restrict, suspend, or reject any respective payments — and to close the account — subject to the requirements of applicable AML laws and regulations.</p>
          </div>
          <p>Blockchain transactions are immutable and permanently recorded on public ledgers. Bluvfi cooperates with law enforcement agencies and regulatory authorities to provide on-chain transaction data where legally required.</p>
        </section>

        {/* 11 */}
        <section className="pp-section" id="a11">
          <div className="pp-section-head"><span className="pp-num">11</span><h2>Contact Information</h2></div>
          <p>If you have questions about our AML Policy, need to report suspicious activity, or wish to cooperate with a compliance inquiry, please contact our Compliance team:</p>
          <div className="pp-contact-grid">
            {[
              { label: 'Compliance Officer', value: 'hivepod@bluvfi.xyz',  href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'General Support',    value: 'hivepod@bluvfi.xyz',  href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'Follow Us on X',     value: '@bluvfi',              href: 'https://x.com/bluvfi' },
              { label: 'Telegram Community', value: 'Join our Telegram',    href: 'https://t.me/+KXpDSUAnfg44MTg0' },
            ].map(c => (
              <div className="pp-contact-item" key={c.label}>
                <span className="pp-contact-label">{c.label}</span>
                <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="pp-link">{c.value}</a>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '20px', color: 'rgba(238,252,245,0.55)', fontSize: '0.88rem' }}>
            <strong style={{ color: 'rgba(238,252,245,0.75)' }}>Operated by:</strong> Hivepod Digital Solutions &nbsp;·&nbsp; <strong style={{ color: 'rgba(238,252,245,0.75)' }}>Effective:</strong> August 27, 2026
          </p>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="pp-footer">
        <p>© 2026 Bluvfi. All rights reserved.</p>
        <div className="pp-footer-links">
          <a href="/">Home</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/aml" aria-current="page">AML Policy</a>
          <a href="/cookies">Cookie Policy</a>
          <a href="https://x.com/bluvfi" target="_blank" rel="noopener noreferrer">X / Twitter</a>
          <a href="https://t.me/+KXpDSUAnfg44MTg0" target="_blank" rel="noopener noreferrer">Telegram</a>
        </div>
      </footer>
    </div>
  )
}

// ── Cookie Policy Page ───────────────────────────────────────────────────────
const CookiePolicyPage: React.FC = () => {
  const cookieTypes = [
    {
      type: 'Essential Cookies',
      purpose: 'Required for the website and app to function. Includes session tokens, wallet connection state, and security cookies.',
      duration: 'Session / Persistent',
    },
    {
      type: 'Performance Cookies',
      purpose: 'Help us understand how visitors interact with Bluvfi — which features are used, load times, and error rates.',
      duration: 'Up to 12 months',
    },
    {
      type: 'Functionality Cookies',
      purpose: 'Remember your preferences such as language, theme, and previously connected wallet provider.',
      duration: 'Up to 12 months',
    },
    {
      type: 'Analytics Cookies',
      purpose: 'Aggregate, anonymised data on traffic and usage patterns to help us improve the Service.',
      duration: 'Up to 24 months',
    },
    {
      type: 'Session Cookies',
      purpose: 'Temporary cookies that keep you authenticated during a single browsing session.',
      duration: 'Expire on browser close',
    },
    {
      type: 'Persistent Cookies',
      purpose: 'Stored between sessions to preserve login state and settings across visits.',
      duration: 'Until expiry or deletion',
    },
    {
      type: 'First-Party Cookies',
      purpose: 'Set directly by bluvfi.app to power core features.',
      duration: 'Varies',
    },
    {
      type: 'Third-Party Cookies',
      purpose: 'Set by trusted third-party services we use (e.g., Privy for wallet auth, Circle for payments).',
      duration: 'Varies',
    },
  ]

  return (
    <div className="pp-page">
      {/* ── Sticky Nav ── */}
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <a href="/" className="Bluvfi-brand pp-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
            <span>Bluvfi</span>
          </a>
          <a href="/" className="pp-back">← Back to home</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="pp-hero">
        <span className="pp-pill">Legal</span>
        <h1 className="pp-h1">Cookie <span className="pp-accent">Policy</span></h1>
        <p className="pp-meta">
          <strong>Last updated: August 27, 2026</strong>
          &nbsp;·&nbsp;How Bluvfi uses cookies and similar tracking technologies.
        </p>
      </header>

      {/* ── TOC ── */}
      <div className="pp-toc-wrap">
        <div className="pp-toc">
          <p className="pp-toc-label">Contents</p>
          <ol className="pp-toc-list">
            {[
              { id: 'c1', title: 'What Are Cookies?' },
              { id: 'c2', title: 'How We Use Cookies' },
              { id: 'c3', title: 'Types of Cookies We Use' },
              { id: 'c4', title: 'Managing Cookies' },
              { id: 'c5', title: 'Policy Updates' },
              { id: 'c6', title: 'Contact Us' },
            ].map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`}>0{i + 1}. {s.title}</a></li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Sections ── */}
      <main className="pp-content">

        {/* 01 */}
        <section className="pp-section" id="c1">
          <div className="pp-section-head"><span className="pp-num">01</span><h2>What Are Cookies?</h2></div>
          <p>Cookies are small text files that are placed on your computer, smartphone, or other device when you visit Bluvfi. They allow us to recognise your device and remember certain information about your visit — such as your wallet connection preferences, feature settings, and security tokens.</p>
          <p>Similar technologies such as local storage, session storage, and pixel tags may also be used in the same way as cookies. References to "cookies" in this policy include these technologies unless stated otherwise.</p>
          <div className="pp-info">
            <p>Cookies do not contain personally identifiable information on their own. We only link cookie data to information you have provided us when you create an account or connect a wallet.</p>
          </div>
        </section>

        {/* 02 */}
        <section className="pp-section" id="c2">
          <div className="pp-section-head"><span className="pp-num">02</span><h2>How We Use Cookies</h2></div>
          <p>Bluvfi uses cookies for several purposes to make our platform work well and to improve your experience:</p>
          <div className="pp-card-grid">
            {[
              {
                title: '🔐 Essential',
                body: 'Necessary for the Service to function. Without these cookies, core features like wallet connection, session authentication, and transaction signing cannot operate.',
              },
              {
                title: '📊 Performance',
                body: 'Help us understand how users interact with the Service — which pages load slowly, where errors occur, and how features are used — so we can improve reliability.',
              },
              {
                title: '⚙️ Functionality',
                body: 'Remember choices you make — such as dark/light mode, preferred wallet provider, or language — to provide a more personalised experience across sessions.',
              },
              {
                title: '📈 Analytics',
                body: 'Aggregate, anonymised data on traffic patterns and feature usage. This helps us make informed product decisions without identifying individual users.',
              },
            ].map(c => (
              <div className="pp-card" key={c.title}>
                <strong>{c.title}</strong>
                <span>{c.body}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 03 */}
        <section className="pp-section" id="c3">
          <div className="pp-section-head"><span className="pp-num">03</span><h2>Types of Cookies We Use</h2></div>
          <p>The table below describes the categories of cookies placed on your device when you use Bluvfi:</p>
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
              color: 'rgba(238,252,245,0.85)',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(36,216,149,0.25)' }}>
                  {['Cookie Type', 'Purpose', 'Duration'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      color: '#24d895',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cookieTypes.map((row, i) => (
                  <tr key={row.type} style={{
                    borderBottom: '1px solid rgba(36,216,149,0.08)',
                    background: i % 2 === 0 ? 'rgba(36,216,149,0.03)' : 'transparent',
                  }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, whiteSpace: 'nowrap', color: 'rgba(238,252,245,0.95)' }}>{row.type}</td>
                    <td style={{ padding: '12px 14px', lineHeight: 1.5 }}>{row.purpose}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'rgba(238,252,245,0.65)' }}>{row.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 04 */}
        <section className="pp-section" id="c4">
          <div className="pp-section-head"><span className="pp-num">04</span><h2>Managing Cookies</h2></div>
          <p>Most web browsers allow you to control cookies through their settings. You can typically:</p>
          <ul>
            <li>View what cookies are stored on your device and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block cookies from particular sites</li>
            <li>Block all cookies from being set</li>
            <li>Delete all cookies when you close your browser</li>
          </ul>
          <div className="pp-highlight">
            <p><strong>Important:</strong> If you disable or delete essential cookies, parts of Bluvfi may not work correctly. In particular, wallet authentication (via Privy) and USDC payment sessions (via Circle Gateway) rely on secure session cookies to function. Disabling them will require you to re-authenticate on each visit.</p>
          </div>
          <p>You can manage cookies in your browser settings. Below are links for the most common browsers:</p>
          <div className="pp-card-grid">
            {[
              { name: 'Google Chrome', url: 'https://support.google.com/chrome/answer/95647' },
              { name: 'Mozilla Firefox', url: 'https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer' },
              { name: 'Safari', url: 'https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac' },
              { name: 'Microsoft Edge', url: 'https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09' },
            ].map(b => (
              <div className="pp-card" key={b.name} style={{ padding: '12px 16px' }}>
                <strong>{b.name}</strong>
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="pp-link" style={{ fontSize: '0.82rem' }}>Cookie settings guide →</a>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '16px' }}>You may also opt out of analytics tracking by adjusting your browser's "Do Not Track" setting, where supported.</p>
        </section>

        {/* 05 */}
        <section className="pp-section" id="c5">
          <div className="pp-section-head"><span className="pp-num">05</span><h2>Policy Updates</h2></div>
          <p>We may update this Cookie Policy from time to time as our technology, legal obligations, or the cookies we use change. Any updates will be posted on this page with a revised "Last updated" date at the top.</p>
          <p>We encourage you to review this page periodically. Where changes are material — for example, if we begin using a new category of cookies — we will notify you via the app or email before the change takes effect.</p>
          <div className="pp-info">
            <p>Continued use of Bluvfi after a Cookie Policy update constitutes your acceptance of the revised policy, consistent with our <a href="/terms" className="pp-link">Terms of Service</a>.</p>
          </div>
        </section>

        {/* 06 */}
        <section className="pp-section" id="c6">
          <div className="pp-section-head"><span className="pp-num">06</span><h2>Contact Us</h2></div>
          <p>If you have any questions about this Cookie Policy or how we use cookies on the Bluvfi platform, please contact us:</p>
          <div className="pp-contact-grid">
            {[
              { label: 'Email',              value: 'hivepod@bluvfi.xyz',   href: 'mailto:hivepod@bluvfi.xyz' },
              { label: 'X / Twitter',        value: '@bluvfi',               href: 'https://x.com/bluvfi' },
              { label: 'Telegram Community', value: 'Join our Telegram',     href: 'https://t.me/+KXpDSUAnfg44MTg0' },
            ].map(c => (
              <div className="pp-contact-item" key={c.label}>
                <span className="pp-contact-label">{c.label}</span>
                <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="pp-link">{c.value}</a>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '20px', color: 'rgba(238,252,245,0.55)', fontSize: '0.88rem' }}>
            <strong style={{ color: 'rgba(238,252,245,0.75)' }}>Operated by:</strong> Hivepod Digital Solutions &nbsp;·&nbsp; <strong style={{ color: 'rgba(238,252,245,0.75)' }}>Effective:</strong> August 27, 2026
          </p>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="pp-footer">
        <p>© 2026 Bluvfi. All rights reserved.</p>
        <div className="pp-footer-links">
          <a href="/">Home</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/aml">AML Policy</a>
          <a href="/cookies" aria-current="page">Cookie Policy</a>
          <a href="https://x.com/bluvfi" target="_blank" rel="noopener noreferrer">X / Twitter</a>
          <a href="https://t.me/+KXpDSUAnfg44MTg0" target="_blank" rel="noopener noreferrer">Telegram</a>
        </div>
      </footer>
    </div>
  )
}

// ── Router (no extra dep — just pathname) ────────────────────────────────────
// NOTE: Each page component is its own branch so React's Rules of Hooks
// are satisfied in each component individually.
export default function App({ thirdwebClient }: AppProps) {
  const path = window.location.pathname
  if (path === '/privacy') return <PrivacyPolicyPage />
  if (path === '/terms')   return <TermsOfServicePage />
  if (path === '/aml')     return <AMLPolicyPage />
  if (path === '/cookies') return <CookiePolicyPage />
  return <AppDApp thirdwebClient={thirdwebClient} />
}

const BluvfiLandingPage: React.FC = () => {
  const workflowSteps = [
    ['Sign up with email or social', 'Privy creates an embedded EOA wallet with no seed phrase or browser extension required.'],
    ['Browse bills and investments', '16 bills and 10 assets are already loaded.'],
    ['Pay by tap or chat', 'Subscribe, Buy, or say "Pay my Netflix" and approve the same inline confirmation flow.'],
    ['Settle and track history', 'Every payment runs through Arc AppKit send and Circle Gateway x402 nanopayments.'],
  ]

  const features = [
    ['AI agent', 'GPT 4o mini can list bills, queue payments, buy investments, check Gateway balance, deposit, withdraw, and pay x402 URLs.'],
    ['Voice input', 'OpenAI Whisper transcribes spoken requests into the same payment ready chat commands.'],
    ['Gasless payments', 'Sending money has a tiny extra fee (like a stamp on a letter). Bluvfi pays that stamp for you, so you only need your own coins to send.'],
    ['Embedded wallet', "When you want to pay, the app already knows your piggy bank. You don't have to go find it yourself."],
    ['Add Funds', 'Send from a browser wallet or bridge USDC from eight source mainnets into the agent wallet.'],
    ['Unified state', 'The app remembers everything you do, like a notebook that never forgets, so your dashboard and your chat always show the same stuff.'],
  ]

  const integrations = [
    ['Bill and asset payments', 'Payment modal', 'Transfers USDC gaslessly from the Privy wallet via arcKit.send().'],
    ['Chat bill confirm', 'Bill confirmation card', 'Runs the same send path from an inline AI confirmation card.'],
    ['Chat investment confirm', 'Asset confirmation card', 'Executes purchases from chat and updates the portfolio.'],
    ['Funding sheet', 'Fund wallet sheet', 'Supports Arc AppKit Send and Bridge tabs for USDC top ups.'],
    ['Payment request', 'Asks what needs to be paid', 'Bluvfi checks the payment details before money moves.'],
    ['Payment confirmation', 'Marks the payment as done', 'After you approve, Bluvfi confirms the payment and adds it to your history.'],
  ]

  const setupItems = [
    ['Framework', 'Next.js 15, React 19, TypeScript, Tailwind CSS v4, PWA ready, deployed on Vercel.'],
    ['AI', 'Vercel AI SDK v6 with OpenAI GPT 4o mini for chat and OpenAI Whisper for voice transcription.'],
    ['Wallets and chain', 'Privy embedded EOA wallets, wagmi v2, viem, Arc AppKit — chain-agnostic, works across all supported mainnets.'],
    ['Data', 'React context plus localStorage for UI state, Neon Postgres and Drizzle ORM for payment history.'],
    ['Environment', 'Privy, Alchemy, Neon, OpenAI, Circle buyer private key, seller address, and app URL variables.'],
  ]

  const securityLayers = [
    ['Encryption at rest', 'Data Encryption', 'Sensitive account, payment, and activity records are protected with modern encryption practices designed for resilient data storage.'],
    ['Sensitive channels', 'End to End Encryption', 'Private communications and wallet related flows are designed to reduce exposure while requests move through the Bluvfi experience.'],
    ['API and webhooks', 'API Security', 'Server endpoints use authorization checks, signed payload patterns, and request validation to reduce tampering risk during transmission.'],
  ]

  const securityOperations = [
    ['Non Custodial Design', 'Bluvfi is designed around embedded wallets and user confirmation, so users keep control of funds where payment execution applies.'],
    ['Cloud Infrastructure', 'The platform is built for highly available cloud environments with industry standard operational security practices.'],
    ['Continuous Monitoring', 'Payment, API, and application activity can be monitored for anomalies, abuse patterns, and unexpected settlement behavior.'],
    ['Access Controls', 'Administrative systems should use role based access controls, least privilege permissions, and multi factor authentication.'],
  ]

  return (
    <div className="app Bluvfi-app-shell">
      <NotificationToasts />

      <header className="Bluvfi-nav">
        <div className="Bluvfi-brand">
          <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
          <span>Bluvfi</span>
        </div>
        <nav className="Bluvfi-links" aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#circle">Circle</a>
          <a href="#faq">FAQ</a>
          <a href="#setup">Setup</a>
        </nav>
        <a className="Bluvfi-nav-cta" href="#waitlist">
          Join waitlist
        </a>
      </header>

      <main className="landing-redesign">
        <section className="Bluvfi-hero">
          <div className="Bluvfi-hero-copy">
            <p className="Bluvfi-kicker">Bluvfi AI Financial Assistant</p>
            <h1 className="Bluvfi-title">
              Pay bills, subscribe to services, and invest by chat or tap.
            </h1>
            <p className="Bluvfi-subtitle">
              Bluvfi is a mobile first AI financial assistant for subscriptions,
              utilities, internet and cable bills, stocks, ETFs, and pre IPO
              investments. It feels web2 simple while every payment follows the
              same gasless on chain path.
            </p>
            <div className="Bluvfi-actions">
              <a className="Bluvfi-primary-btn" href="#waitlist">
                Join waitlist
              </a>
              <a className="Bluvfi-secondary-btn" href="#how-it-works">
                See how it works
              </a>
            </div>
            <div className="Bluvfi-trust-row" aria-label="Product highlights">
              <span>Privy embedded wallet</span>
              <span>Gasless USDC payments</span>
              <span>Circle Gateway x402 settlement</span>
            </div>
          </div>

          <div className="Bluvfi-console-stage" aria-label="Bluvfi app preview">
            <div className="Bluvfi-console">
              <div className="phone-topbar">
                <span>Good afternoon, Maya</span>
                <span>LIVE</span>
              </div>
              <div className="balance-card">
                <span>USDC balance</span>
                <strong>$84.37</strong>
                <small>Low gas friction. Users only need USDC, no ETH required.</small>
              </div>
              <div className="quick-actions">
                <span>Bills</span>
                <span>Invest</span>
                <span>Chat</span>
              </div>
              <div className="activity-card deposit">
                <div>
                  <span>Netflix</span>
                  <p>Confirmed from chat</p>
                </div>
                <strong>Active</strong>
              </div>
              <div className="activity-card">
                <div>
                  <span>QQQ purchase</span>
                  <p>Portfolio updated</p>
                </div>
                <strong>Settled</strong>
              </div>
            </div>
            <div className="floating-receipt">
              <span>History</span>
              <strong>Nanopay settlement succeeded</strong>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="Bluvfi-section Bluvfi-split">
          <div>
            <p className="Bluvfi-kicker">How it works</p>
            <h2>One payment path for every button and every chat command.</h2>
            <p>
              UI payments and AI triggered confirmations both call arcKit.send()
              from the user's Privy wallet, then run the same Circle Gateway x402
              checkout and update the same shared payment state.
            </p>
          </div>
          <div className="chain-panel">
            {workflowSteps.map(([label, copy]) => (
              <div className="chain-row" key={label}>
                <span>{label}</span>
                <strong>{copy}</strong>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="Bluvfi-section">
          <div className="section-intro">
            <p className="Bluvfi-kicker">Features</p>
            <h2>Built like a familiar finance app, powered by AI and USDC.</h2>
          </div>
          <div className="feature-card-grid">
            {features.map(([title, copy]) => (
              <article className="payment-card" key={title}>
                <span className="payment-icon">{title.slice(0, 2).toUpperCase()}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="Bluvfi-section benefit-band">
          {[
            '16 bills across streaming, internet, cable, and utilities',
            '10 assets across stocks, ETFs, and pre IPO opportunities',
            'Low balance alert with a one tap Add Funds sheet',
            'History tab marks successful entries with Nanopay settlement',
          ].map((benefit) => (
            <div className="benefit-item" key={benefit}>
              <span></span>
              <p>{benefit}</p>
            </div>
          ))}
        </section>

        <section id="security" className="Bluvfi-section security-section">
          <div className="security-hero">
            <p className="Bluvfi-kicker">Security and Compliance</p>
            <h2>Enterprise security for AI powered financial actions.</h2>
            <p>
              Bluvfi is designed with protective layers for wallet initiated
              payments, AI triggered confirmation flows, API calls, and payment
              history. The goal is a simple user experience backed by careful
              controls at every layer.
            </p>
            <div className="security-actions">
              <a className="Bluvfi-primary-btn" href="mailto:hivepod@bluvfi.xyz">
                Contact Security Team
              </a>
            </div>
          </div>

          <div className="section-intro">
            <p className="Bluvfi-kicker">Designed for Defense</p>
            <h2>The protective layers securing the Bluvfi platform.</h2>
          </div>

          <div className="security-card-grid">
            {securityLayers.map(([eyebrow, title, copy]) => (
              <article className="security-card" key={title}>
                <span>{eyebrow}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <strong>{title}</strong>
              </article>
            ))}
          </div>

          <div className="security-ops">
            <div className="section-intro">
              <p className="Bluvfi-kicker">Standards and Operations</p>
              <h2>Meeting modern security demands with continuous controls.</h2>
            </div>
            <div className="security-ops-grid">
              {securityOperations.map(([title, copy]) => (
                <article className="security-op" key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="security-question">
            <h2>Questions about our security?</h2>
            <p>
              Our security team can answer questions about wallet design,
              payment flow controls, data handling, and operational practices.
            </p>
            <div className="security-actions centered-actions">
              <a className="Bluvfi-primary-btn" href="mailto:hivepod@bluvfi.xyz">
                Contact Security Team
              </a>
            </div>
          </div>
        </section>

        <section id="circle" className="Bluvfi-section">
          <div className="section-intro">
            <p className="Bluvfi-kicker">Circle integrations</p>
            <h2>Arc AppKit moves USDC. Circle Gateway settles nanopayments.</h2>
            <p>
              Payments use Privy's embedded wallet provider with
              arcKit.send() across supported mainnet chains.
              Bluvfi is chain-agnostic — funding supports browser wallet sends
              and bridges from multiple source mainnets.
            </p>
          </div>
          <div className="integration-grid">
            {integrations.map(([title, file, copy]) => (
              <article className="integration-card" key={title}>
                <span>{file}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="Bluvfi-section catalog-section">
          <div className="section-intro">
            <p className="Bluvfi-kicker">Catalog</p>
            <h2>Loaded with real feeling data from the first screen.</h2>
          </div>
          <div className="catalog-grid">
            <div>
              <h3>Bills</h3>
              <p>
                Netflix, Spotify, Max, Disney+, Apple TV+, Hulu, YouTube
                Premium, Amazon Prime, Xfinity Internet, AT&T Fiber, Verizon Home
                Internet, Xfinity TV, DirecTV, Electric, Water & Sewer, and
                Natural Gas.
              </p>
            </div>
            <div>
              <h3>Assets</h3>
              <p>
                Stocks: AAPL, TSLA, GOOGL, MSFT, NVDA, AMZN. Pre IPO: SPACEX
                and OPENAI. ETFs: SPY and QQQ.
              </p>
            </div>
          </div>
        </section>

        <section id="setup" className="Bluvfi-section">
          <div className="setup-content">
            <p className="Bluvfi-kicker">Tech stack and setup</p>
            <h2>Everything needed for the build.</h2>
            <div className="setup-list">
              {setupItems.map(([title, copy]) => (
                <details key={title}>
                  <summary>
                    {title}
                    <span>+</span>
                  </summary>
                  <p>{copy}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="Bluvfi-section">
          <div className="setup-content">
            <p className="Bluvfi-kicker">Got questions?</p>
            <h2>Simple answers to simple questions</h2>
            <div className="setup-list">
              {[
                {
                  q: 'What is Bluvfi, in plain English?',
                  a: 'Bluvfi is a mobile first AI financial assistant that helps you pay bills, manage subscriptions, and buy investments by chat or tap. You stay in control because every action still asks for confirmation before payment.',
                },
                {
                  q: 'Is my money safe?',
                  a: 'Yes. Payments come from your embedded wallet only after you confirm them. Bluvfi keeps crypto details out of the way, records history, and uses the same checked payment path for chat and button actions.',
                },
                {
                  q: 'How is this different from just using an AI chatbot?',
                  a: 'A chatbot only talks. Bluvfi can prepare real bill payments and investment purchases, then show a confirmation card so you can approve the action in the same app.',
                },
                {
                  q: 'Can I stop the AI anytime?',
                  a: 'Yes. The AI queues actions for confirmation. Nothing is paid just because the AI suggests it, and cancelled payments are treated as normal user cancellations.',
                },
                {
                  q: 'Is Bluvfi ready to use right now?',
                  a: 'Bluvfi is being built now. Join the waitlist below to get access when it opens.',
                },
              ].map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                    <span>+</span>
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="waitlist" className="Bluvfi-section waitlist-section">
          <p className="Bluvfi-kicker">Be first in line</p>
          <h2>Ready for financial errands by chat or tap?</h2>
          <p>
            Join the waitlist and we will let you know when Bluvfi is ready to
            try.
          </p>
          <TallyEmbed />
        </section>

        <footer className="Bluvfi-footer">
          <div className="Bluvfi-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
            <span>Bluvfi</span>
          </div>
          <div className="footer-links">
            <a
              href="https://x.com/bluvfi"
              target="_blank"
              rel="noopener noreferrer"
            >
              X / Twitter
            </a>
            <a
              href="https://t.me/+KXpDSUAnfg44MTg0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/aml">AML Policy</a>
            <a href="/cookies">Cookie Policy</a>
          </div>
          <p>Bluvfi is an AI financial assistant product built under Hivepod Digital Solutions(the Company).</p>
        </footer>
      </main>
    </div>
  )
}

// Enhanced Asset Preview Component
const EnhancedAssetPreview: React.FC<{
  assetId: number
  asset: IPAsset
  metadata: any
  mediaUrl: string
}> = ({ assetId, asset, metadata, mediaUrl }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const fetchImageFromMetadata = async () => {
      try {
        setLoading(true)
        setImageError(false)

        // Priority 1: Check if metadata has image field
        if (metadata?.image) {
          let imageSource = metadata.image

          // Convert IPFS URLs to gateway URLs
          if (imageSource.startsWith('ipfs://')) {
            imageSource = `https://gateway.pinata.cloud/ipfs/${imageSource.replace('ipfs://', '')}`
          }

          setImageUrl(imageSource)
        }
        // Priority 2: Try the asset's ipHash directly
        else if (asset.ipHash) {
          let gatewayUrl = asset.ipHash
          if (gatewayUrl.startsWith('ipfs://')) {
            gatewayUrl = `https://gateway.pinata.cloud/ipfs/${gatewayUrl.replace('ipfs://', '')}`
          }
          setImageUrl(gatewayUrl)
        }
        // Priority 3: Use mediaUrl as fallback
        else if (mediaUrl) {
          setImageUrl(mediaUrl)
        } else {
          setImageUrl(null)
        }
      } catch (error) {
        console.error('Error fetching image from metadata:', error)
        setImageUrl(null)
      } finally {
        setLoading(false)
      }
    }

    fetchImageFromMetadata()
  }, [metadata, asset.ipHash, mediaUrl])

  const handleImageError = () => {
    setImageError(true)
  }

  if (loading) {
    return (
      <div
        className="preview-skeleton"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="skeleton skeleton-image"
          style={{ width: '100%', height: '100%' }}
        ></div>
      </div>
    )
  }

  const showImage = imageUrl && !imageError
  const finalMediaUrl = imageUrl || mediaUrl || asset.ipHash || ''

  return (
    <>
      {showImage ? (
        <img
          src={imageUrl!}
          alt={metadata?.name || `IP Asset ${assetId}`}
          className="media-image"
          onError={handleImageError}
          style={{ display: 'block' }}
        />
      ) : null}
      <div
        className="media-fallback"
        style={{ display: showImage ? 'none' : 'flex' }}
      >
        <div className="media-fallback-icon">📄</div>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          Media Preview
        </p>
        {finalMediaUrl && (
          <a
            href={finalMediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="media-link"
          >
            🔗 View Media
          </a>
        )}
      </div>
    </>
  )
}

function AppDApp({ thirdwebClient }: AppProps) {
  const account = useActiveAccount()
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } =
    useNotificationHelpers()

  const [loading, setLoading] = useState<boolean>(false)
  const [backendStatus, setBackendStatus] = useState<boolean>(false)

  // IP Assets state
  const [ipAssets, setIpAssets] = useState<Map<number, IPAsset>>(new Map())

  // Licenses state
  const [licenses, setLicenses] = useState<Map<number, License>>(new Map())

  // Parsed metadata state
  const [parsedMetadata, setParsedMetadata] = useState<Map<number, any>>(
    new Map(),
  )

  // Form states
  const [ipFile, setIpFile] = useState<File | null>(null)
  const [ipHash, setIpHash] = useState<string>('')
  const [ipName, setIpName] = useState<string>('')
  const [ipDescription, setIpDescription] = useState<string>('')
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false)

  const [selectedTokenId, setSelectedTokenId] = useState<number>(1)
  const [royaltyPercentage, setRoyaltyPercentage] = useState<number>(10)
  const [licenseDuration, setLicenseDuration] = useState<number>(86400)
  // License parameters
  const [commercialUse, setCommercialUse] = useState<boolean>(true)
  const [commercialAttribution, setCommercialAttribution] =
    useState<boolean>(true)
  const [commercializerChecker, setCommercializerChecker] = useState<string>(
    '0x0000000000000000000000000000000000000000',
  )
  const [commercializerCheckerData, setCommercializerCheckerData] =
    useState<string>('0000000000000000000000000000000000000000')
  const [commercialRevShare, setCommercialRevShare] =
    useState<number>(100000000)
  const [commercialRevCeiling, setCommercialRevCeiling] = useState<number>(0)
  const [derivativesAllowed, setDerivativesAllowed] = useState<boolean>(true)
  const [derivativesAttribution, setDerivativesAttribution] =
    useState<boolean>(true)
  const [derivativesApproval, setDerivativesApproval] = useState<boolean>(false)
  const [derivativesReciprocal, setDerivativesReciprocal] =
    useState<boolean>(true)
  const [derivativeRevCeiling, setDerivativeRevCeiling] = useState<number>(0)
  const [licenseCurrency, setLicenseCurrency] = useState<string>(
    '0x15140000000000000000000000000000000000000',
  )
  const [selectedLicenseTemplate, setSelectedLicenseTemplate] =
    useState<string>('custom')

  const [paymentAmount, setPaymentAmount] = useState<string>('0.001')
  const [paymentTokenId, setPaymentTokenId] = useState<number>(1)

  const [claimTokenId, setClaimTokenId] = useState<number>(1)

  // Royalty calculation states
  interface RoyaltyBreakdown {
    totalAmount: number
    platformFee: number
    remainingAfterFee: number
    licenseRoyalties: Array<{
      licenseId: number
      licensee: string
      royaltyPercentage: number
      amount: number
    }>
    ipOwnerShare: number
  }

  const [royaltyBreakdown, setRoyaltyBreakdown] =
    useState<RoyaltyBreakdown | null>(null)
  const [accumulatedRoyalties, setAccumulatedRoyalties] = useState<
    Map<number, bigint>
  >(new Map()) // tokenId => claimable amount

  // Constants matching contract
  const ROYALTY_DECIMALS = 10000 // 10000 = 100%
  const PLATFORM_FEE_PERCENTAGE = 250 // 2.5% = 250 basis points

  // Calculate royalty breakdown (mirrors contract logic)
  const calculateRoyaltyBreakdown = (
    paymentAmount: number,
    tokenId: number,
  ): RoyaltyBreakdown | null => {
    if (!paymentAmount || paymentAmount <= 0) return null
    if (!ipAssets.has(tokenId)) return null

    const paymentAmountWei = parseFloat(paymentAmount.toString()) * 1e18 // Convert to wei for calculation
    const paymentAmountBigInt = BigInt(Math.floor(paymentAmountWei))

    // Calculate platform fee
    const platformFee =
      (paymentAmountBigInt * BigInt(PLATFORM_FEE_PERCENTAGE)) /
      BigInt(ROYALTY_DECIMALS)
    const remainingAfterFee = paymentAmountBigInt - platformFee

    // Get active licenses for this token
    const activeLicenses: Array<{
      licenseId: number
      license: License
    }> = []

    licenses.forEach((license, licenseId) => {
      if (
        Number(license.tokenId) === tokenId &&
        license.isActive &&
        Date.now() / 1000 < Number(license.startDate) + Number(license.duration)
      ) {
        activeLicenses.push({ licenseId, license })
      }
    })

    // Calculate license royalties
    const licenseRoyalties = activeLicenses.map(({ licenseId, license }) => {
      const royaltyAmount =
        (remainingAfterFee * license.royaltyPercentage) /
        BigInt(ROYALTY_DECIMALS)
      return {
        licenseId,
        licensee: license.licensee,
        royaltyPercentage: Number(license.royaltyPercentage) / 100, // Convert to percentage
        amount: Number(royaltyAmount) / 1e18, // Convert from wei
      }
    })

    const totalLicenseRoyalties = licenseRoyalties.reduce(
      (sum, lr) => sum + lr.amount,
      0,
    )
    const ipOwnerShare =
      Number(remainingAfterFee) / 1e18 - totalLicenseRoyalties

    return {
      totalAmount: paymentAmount,
      platformFee: Number(platformFee) / 1e18,
      remainingAfterFee: Number(remainingAfterFee) / 1e18,
      licenseRoyalties,
      ipOwnerShare: Math.max(0, ipOwnerShare), // Ensure non-negative
    }
  }

  // Load accumulated royalties for a token
  const loadAccumulatedRoyalties = async (tokenId: number) => {
    if (!account?.address) return

    try {
      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Get royalty info for the connected account
      const royaltyInfo = (await readContract({
        contract,
        method: 'getRoyaltyInfo' as any,
        params: [BigInt(tokenId), account.address],
      })) as readonly [bigint, bigint, bigint, bigint]

      const claimableAmount = royaltyInfo[1] // claimableAmount_
      setAccumulatedRoyalties((prev) => {
        const newMap = new Map(prev)
        newMap.set(tokenId, claimableAmount)
        return newMap
      })
    } catch (error: any) {
      // Silently handle errors (e.g., if no royalties exist)
      console.log('No royalties found or error loading:', error)
      setAccumulatedRoyalties((prev) => {
        const newMap = new Map(prev)
        newMap.set(tokenId, 0n)
        return newMap
      })
    }
  }

  // Arbitration states
  const [disputesMap, setDisputesMap] = useState<Map<number, any>>(new Map())
  // const [arbitrationsMap, setArbitrationsMap] = useState<Map<number, any>>(new Map()); // Reserved for future use
  const [arbitratorsMap, setArbitratorsMap] = useState<Map<string, any>>(
    new Map(),
  )
  const [disputeTokenId, setDisputeTokenId] = useState<number>(1)
  const [disputeReason, setDisputeReason] = useState<string>('')
  const [arbitrationDecision, setArbitrationDecision] = useState<boolean>(true)
  const [arbitrationResolution, setArbitrationResolution] = useState<string>('')
  const [arbitrationDisputeId, setArbitrationDisputeId] = useState<number>(0)
  const [minArbitratorStake, setMinArbitratorStake] =
    useState<string>('0.000000001')
  const [allArbitrators, setAllArbitrators] = useState<string[]>([])
  const [activeArbitratorsCount, setActiveArbitratorsCount] =
    useState<number>(0)
  const [resolveDisputeId, setResolveDisputeId] = useState<number>(0)
  const [assignDisputeId, setAssignDisputeId] = useState<number>(0)
  const [selectedArbitrators, setSelectedArbitrators] = useState<string[]>([])
  const [arbitrationsMap, setArbitrationsMap] = useState<Map<number, any>>(
    new Map(),
  )
  const [isOwner, setIsOwner] = useState<boolean>(false)

  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'register'
    | 'license'
    | 'revenue'
    | 'arbitration'
    | 'infringement'
  >('dashboard')

  // Infringement detection states
  interface InfringementData {
    id: string
    status: string
    result: string
    inNetworkInfringements: Array<{
      id?: string
      url?: string
      similarity?: number
      detected_at?: string
      type?: string
    }>
    externalInfringements: Array<{
      id?: string
      url?: string
      similarity?: number
      detected_at?: string
      type?: string
      platform?: string
    }>
    credits?: {
      used?: number
      remaining?: number
    }
    lastChecked: string | null
    totalInfringements: number
  }

  const [infringementData, setInfringementData] = useState<
    Map<number, InfringementData>
  >(new Map())
  const [infringementLoadingIds, setInfringementLoadingIds] = useState<
    Set<number>
  >(new Set())
  const [selectedInfringementTokenId, setSelectedInfringementTokenId] =
    useState<number>(1)
  const autoMonitoringEnabled = true // Auto-monitoring is always enabled
  const monitoringInterval = 300000 // 5 minutes default

  // Load infringement status for an IP asset
  const loadInfringementStatus = async (
    tokenId: number,
    options?: { silent?: boolean },
  ) => {
    if (!ipAssets.has(tokenId)) {
      console.warn(`IP Asset ${tokenId} not found`)
      return
    }

    setInfringementLoadingIds((prev) => new Set(prev).add(tokenId))
    try {
      const contractAddress =
        CONTRACT_ADDRESSES['ModredIPModule#ModredIP'].toLowerCase()
      const response = await fetch(
        `${BACKEND_URL}/api/infringement/status/${contractAddress}/${tokenId}`,
      )

      if (!response.ok) {
        throw new Error(
          `Failed to fetch infringement status: ${response.statusText}`,
        )
      }

      const result = await response.json()
      const infringementStatus: InfringementData = result.data

      setInfringementData((prev) => {
        const newMap = new Map(prev)
        newMap.set(tokenId, infringementStatus)
        return newMap
      })

      // Show notification only when not silent (e.g. user clicked "Check Status")
      if (!options?.silent) {
        if (infringementStatus.totalInfringements > 0) {
          notifyWarning(
            'Infringements Detected',
            `Found ${infringementStatus.totalInfringements} potential infringement(s) for IP Asset #${tokenId}`,
          )
        } else {
          notifyInfo(
            'No Infringements',
            `No infringements detected for IP Asset #${tokenId}`,
          )
        }
      }
    } catch (error: any) {
      console.error('Error loading infringement status:', error)
      if (!options?.silent && !error.message?.includes('404')) {
        notifyError(
          'Infringement Check Failed',
          error.message || 'Failed to check infringement status',
        )
      }
    } finally {
      setInfringementLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(tokenId)
        return next
      })
    }
  }

  // Calculate infringement severity
  const calculateSeverity = (
    infringement: InfringementData,
  ): 'low' | 'medium' | 'high' | 'critical' => {
    if (infringement.totalInfringements === 0) return 'low'

    const hasHighSimilarity = [
      ...infringement.inNetworkInfringements,
      ...infringement.externalInfringements,
    ].some((inf) => (inf.similarity || 0) > 0.9)

    if (hasHighSimilarity && infringement.totalInfringements > 5)
      return 'critical'
    if (hasHighSimilarity || infringement.totalInfringements > 3) return 'high'
    if (infringement.totalInfringements > 1) return 'medium'
    return 'low'
  }

  // Auto-monitoring effect
  useEffect(() => {
    if (
      !autoMonitoringEnabled ||
      !selectedInfringementTokenId ||
      !ipAssets.has(selectedInfringementTokenId)
    )
      return

    // Load immediately
    loadInfringementStatus(selectedInfringementTokenId)

    // Set up interval
    const interval = setInterval(() => {
      if (ipAssets.has(selectedInfringementTokenId)) {
        loadInfringementStatus(selectedInfringementTokenId)
      }
    }, monitoringInterval)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMonitoringEnabled, selectedInfringementTokenId, monitoringInterval])

  // Check backend status
  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/`)
      const wasConnected = backendStatus
      const isConnected = response.ok

      setBackendStatus(isConnected)

      if (!wasConnected && isConnected) {
        notifySuccess(
          'Backend Connected',
          'Successfully connected to the Lobos backend service',
        )
      } else if (wasConnected && !isConnected) {
        notifyError(
          'Backend Disconnected',
          'Lost connection to the Lobos backend service',
        )
      }
    } catch (error) {
      const wasConnected = backendStatus
      setBackendStatus(false)

      if (wasConnected) {
        notifyError(
          'Backend Error',
          'Failed to connect to the Lobos backend service',
        )
      }
    }
  }

  // Check backend status on component mount
  useEffect(() => {
    checkBackendStatus()
  }, [])

  // Handle file selection for IP asset
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processFile(files[0])
    }
  }

  // Process file (shared logic for both upload methods)
  const processFile = async (file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      notifyError('Invalid File', validation.error || 'Invalid file selected')
      return
    }

    try {
      const preview = await generateFilePreview(file)
      setFilePreview(preview)
      setIpFile(file)
      notifyInfo('File Selected', `${file.name} selected for upload`)
    } catch (err) {
      console.error('File preview error:', err)
      setIpFile(file)
      notifyWarning(
        'Preview Error',
        'File selected but preview could not be generated',
      )
    }
  }

  // Upload file to IPFS
  const uploadToIPFS = async () => {
    if (!ipFile) {
      notifyError('No File Selected', 'Please select a file to upload')
      return null
    }

    try {
      setLoading(true)
      notifyInfo('Uploading to IPFS', `Uploading ${ipFile.name} to IPFS...`)

      const uploadResult = await pinFileToIPFS(ipFile)

      if (uploadResult.success && uploadResult.cid) {
        // Clear any previous file preview
        setFilePreview(null)

        // Set the IPFS hash
        const ipfsUrl = `ipfs://${uploadResult.cid}`
        setIpHash(ipfsUrl)

        // Get gateway URL for display
        const gatewayUrl = getIPFSGatewayURL(ipfsUrl)

        // Show success message
        notifySuccess(
          'IPFS Upload Successful',
          `File uploaded successfully!\nCID: ${uploadResult.cid}`,
          {
            action: {
              label: 'View File',
              onClick: () => window.open(gatewayUrl, '_blank'),
            },
          },
        )

        return uploadResult.cid
      } else {
        // Handle specific upload errors
        const errorMessage = uploadResult.message || 'Failed to upload file'
        notifyError('Upload Failed', errorMessage)

        // Reset file selection if upload fails
        setIpFile(null)
        setFilePreview(null)

        return null
      }
    } catch (err: any) {
      console.error('Unexpected upload error:', err)
      notifyError(
        'Upload Error',
        err.message || 'Unexpected error during file upload',
      )

      // Reset file selection
      setIpFile(null)
      setFilePreview(null)

      return null
    } finally {
      setLoading(false)
    }
  }

  // Load contract data
  const loadContractData = async () => {
    if (!account?.address) return

    try {
      setLoading(true)
      const contractAddress = CONTRACT_ADDRESSES['ModredIPModule#ModredIP']
      console.log('📋 Using ModredIP contract:', contractAddress)

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: contractAddress,
      })

      // Get next token ID with error handling
      let nextTokenIdNum = 1
      try {
        const nextId = await readContract({
          contract,
          method: 'nextTokenId',
          params: [],
        })
        nextTokenIdNum = Number(nextId)
        console.log('✅ Loaded nextTokenId:', nextTokenIdNum)
      } catch (error: any) {
        console.warn('⚠️ Error loading nextTokenId:', error?.message || error)
        // If it's a zero data error, the contract might not be fully deployed
        if (
          error?.message?.includes('zero data') ||
          error?.message?.includes('Cannot decode')
        ) {
          console.warn(
            "⚠️ Contract function 'nextTokenId' returned no data. Contract may not be deployed or function not implemented.",
          )
        }
        // Use default value of 1 (no tokens registered yet)
        nextTokenIdNum = 1
      }

      // Get next license ID with error handling
      let nextLicenseIdNum = 1
      try {
        const nextLicenseId = await readContract({
          contract,
          method: 'nextLicenseId',
          params: [],
        })
        nextLicenseIdNum = Number(nextLicenseId)
        console.log('✅ Loaded nextLicenseId:', nextLicenseIdNum)
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'nextLicenseId' not available (contract may not be fully deployed). Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading nextLicenseId:', errorMessage)
        }
        // Use default value of 1 (no licenses registered yet)
        nextLicenseIdNum = 1
      }

      // Load IP assets
      const newIpAssets = new Map<number, IPAsset>()
      for (let i = 1; i < nextTokenIdNum; i++) {
        try {
          const ipAsset = await readContract({
            contract,
            method: 'getIPAsset',
            params: [BigInt(i)],
          })
          newIpAssets.set(i, {
            owner: ipAsset[0],
            ipHash: ipAsset[1],
            metadata: ipAsset[2],
            isEncrypted: ipAsset[3],
            isDisputed: ipAsset[4],
            registrationDate: ipAsset[5],
            totalRevenue: ipAsset[6],
            royaltyTokens: ipAsset[7],
          })
        } catch (error) {
          // Token doesn't exist, skip
        }
      }
      setIpAssets(newIpAssets)

      // Parse metadata for all IP assets
      const newParsedMetadata = new Map<number, any>()
      for (const [id, asset] of newIpAssets.entries()) {
        try {
          const metadata = await parseMetadata(asset.metadata)
          newParsedMetadata.set(id, metadata)
        } catch (error) {
          console.error(`Error parsing metadata for token ${id}:`, error)
          newParsedMetadata.set(id, {
            name: 'Unknown',
            description: 'No description available',
          })
        }
      }
      setParsedMetadata(newParsedMetadata)

      // Load licenses
      const newLicenses = new Map<number, License>()
      for (let i = 1; i < nextLicenseIdNum; i++) {
        try {
          const license = await readContract({
            contract,
            method: 'getLicense',
            params: [BigInt(i)],
          })
          newLicenses.set(i, {
            licensee: license[0],
            tokenId: license[1],
            royaltyPercentage: license[2],
            duration: license[3],
            startDate: license[4],
            isActive: license[5],
            commercialUse: license[6],
            terms: license[7],
          })
        } catch (error) {
          // License doesn't exist, skip
        }
      }
      setLicenses(newLicenses)
    } catch (error: any) {
      // Only log and notify for unexpected errors, not zero data errors
      const errorMessage =
        error?.message || error?.shortMessage || String(error || '')
      const isZeroDataError =
        errorMessage.includes('zero data') ||
        errorMessage.includes('Cannot decode') ||
        errorMessage.includes('AbiDecodingZeroDataError')

      if (!isZeroDataError) {
        console.error('Error loading contract data:', error)
        notifyError('Loading Failed', 'Failed to load contract data')
      } else {
        console.log(
          'ℹ️ Some contract functions returned zero data (expected for new contracts). Continuing with defaults.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContractData()
  }, [account?.address])

  // Auto-load infringement status for all IP assets when the list is loaded
  useEffect(() => {
    const tokenIds = Array.from(ipAssets.keys())
    if (tokenIds.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const id of tokenIds) {
        if (cancelled) return
        await loadInfringementStatus(id, { silent: true })
        await new Promise((r) => setTimeout(r, 350))
      }
    })()
    return () => {
      cancelled = true
    }
    // Intentionally depend only on ipAssets so we run once when assets load, not when infringementData updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipAssets])

  // Create standardized NFT metadata
  const createNFTMetadata = async (
    ipHash: string,
    name: string,
    description: string,
    isEncrypted: boolean,
  ) => {
    // Generate metadata object
    const metadata = {
      name: name || `IP Asset #${Date.now()}`, // Use provided name or generate unique name
      description: description || 'No description provided',
      image: ipHash, // Use IPFS hash as image reference
      properties: {
        ipHash,
        name: name || 'Unnamed',
        description: description || 'No description provided',
        isEncrypted,
        uploadDate: new Date().toISOString(),
      },
    }

    // Upload metadata to IPFS
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json',
    })
    const metadataFile = new File([metadataBlob], 'metadata.json')

    const metadataUploadResult = await pinFileToIPFS(metadataFile)

    if (!metadataUploadResult.success || !metadataUploadResult.cid) {
      throw new Error('Failed to upload metadata to IPFS')
    }

    // Return IPFS URL for metadata
    return `ipfs://${metadataUploadResult.cid}`
  }

  // Register IP using backend API
  const registerIP = async () => {
    if (!account?.address || !ipHash || !ipName.trim()) {
      notifyError(
        'Missing Required Fields',
        'Please fill in all required fields (IP Hash and Name are required)',
      )
      return
    }

    try {
      setLoading(true)

      // Create and upload metadata to IPFS
      const metadataUri = await createNFTMetadata(
        ipHash,
        ipName,
        ipDescription,
        isEncrypted,
      )

      // Prepare comprehensive IP metadata for backend and infringement detection
      const ipMetadata = {
        name: ipName,
        description: ipDescription,
        image: metadataUri,
        creator: account.address,
        created_at: new Date().toISOString(),
        // Additional metadata for better infringement detection
        content_type: ipFile?.type || 'unknown',
        file_size: ipFile?.size || 0,
        mime_type: ipFile?.type || 'unknown',
        tags: [], // Could be enhanced with user input
        category: 'general', // Could be enhanced with user input
        license_type: 'all_rights_reserved',
        commercial_use: false,
        derivatives_allowed: false,
        creator_email: 'creator@lobos.app', // Could be enhanced with user input
        // File-specific metadata
        file_name: ipFile?.name || 'unknown',
        file_extension: ipFile?.name?.split('.').pop() || 'unknown',
        upload_timestamp: new Date().toISOString(),
        // Blockchain metadata
        network: 'bnb-testnet',
        chain_id: '97',
        contract_address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
        // Infringement detection metadata
        monitoring_enabled: true,
        infringement_alerts: true,
        content_hash: ipHash,
        original_filename: ipFile?.name || 'unknown',
      }

      // Prepare NFT metadata for backend
      // const nftMetadata = {
      //   name: ipName,
      //   description: ipDescription,
      //   image: metadataUri,
      //   attributes: [
      //     {
      //       trait_type: "IP Hash",
      //       value: ipHash
      //     },
      //     {
      //       trait_type: "Creator",
      //       value: account.address
      //     },
      //     {
      //       trait_type: "Encrypted",
      //       value: isEncrypted
      //     }
      //   ]
      // };

      // Call backend API
      // Note: If contract doesn't have registerIP function, set skipContractCall: true to test IPFS upload
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipHash: ipHash,
          metadata: JSON.stringify(ipMetadata),
          isEncrypted: isEncrypted,
          lobosContractAddress: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
          skipContractCall: false, // V2 contract has registerIP function, so this should be false
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to register IP'
        let errorData: any = {}
        try {
          errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
          console.error('Registration error details:', errorData)

          // If the error suggests using testing mode, provide helpful message
          if (errorData.suggestion || errorMessage.includes('does not exist')) {
            errorMessage = `${errorMessage}\n\n${errorData.suggestion || 'The contract function does not exist. You can test IPFS upload by setting skipContractCall: true in the request.'}`
          }
        } catch (parseError) {
          // If response is not JSON, try to get text
          const text = await response.text()
          errorMessage = text || errorMessage
          console.error('Registration error (non-JSON):', text)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('IP Registration successful:', result)

      // Show success notification
      if (result.testing) {
        notifySuccess(
          'IP Asset Metadata Created (Testing Mode)',
          `IPFS upload successful!\nIP Hash: ${result.bnbChain.ipHash}\n\nNote: Contract registration was skipped (testing mode).`,
        )
      } else if (result.warning) {
        // Handle case where transaction was submitted but hash couldn't be retrieved
        notifySuccess(
          'IP Asset Registration Submitted',
          `Your IP asset registration was submitted successfully!\n\n${result.warning}\n\nPlease check your IP assets list to confirm the registration.`,
        )
      } else {
        notifySuccess(
          'IP Asset Registered',
          `Successfully registered IP asset!\nTransaction: ${result.bnbChain.txHash}\nIP Asset ID: ${result.bnbChain.ipAssetId}`,
          {
            action: {
              label: 'View Transaction',
              onClick: () =>
                window.open(
                  `https://testnet.bscscan.com/tx/${result.bnbChain.txHash}`,
                  '_blank',
                ),
            },
          },
        )
      }

      // Reset form
      setIpFile(null)
      setIpHash('')
      setIpName('')
      setIpDescription('')
      setIsEncrypted(false)
      setFilePreview(null)

      // Reload data
      await loadContractData()
    } catch (error) {
      console.error('Error registering IP:', error)
      notifyError(
        'Registration Failed',
        error instanceof Error ? error.message : 'Failed to register IP asset',
      )
    } finally {
      setLoading(false)
    }
  }

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days`
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months`
    return `${Math.floor(seconds / 31536000)} years`
  }

  // Apply license template to form
  const applyLicenseTemplate = (templateId: string) => {
    const template = LICENSE_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return

    setSelectedLicenseTemplate(templateId)
    setRoyaltyPercentage(template.royaltyPercentage)
    setLicenseDuration(template.duration)
    setCommercialUse(template.commercialUse)
    setCommercialAttribution(template.commercialAttribution)
    setDerivativesAllowed(template.derivativesAllowed)
    setDerivativesAttribution(template.derivativesAttribution)
    setDerivativesApproval(template.derivativesApproval)
    setDerivativesReciprocal(template.derivativesReciprocal)
    setCommercialRevShare(template.commercialRevShare)
    setCommercialRevCeiling(template.commercialRevCeiling)
    setDerivativeRevCeiling(template.derivativeRevCeiling)
    setCommercializerChecker(template.commercializerChecker)
    setCommercializerCheckerData(template.commercializerCheckerData)
    setLicenseCurrency(template.currency)

    if (templateId !== 'custom') {
      notifyInfo(
        'Template Applied',
        `${template.icon} ${template.name} template has been applied. You can still customize the settings.`,
      )
    }
  }

  // Mint License using backend API
  const mintLicense = async () => {
    if (!account?.address || !selectedTokenId) {
      notifyError(
        'Missing Required Fields',
        'Please fill in all required fields',
      )
      return
    }

    try {
      setLoading(true)

      // Prepare license terms for backend
      const licenseTerms = {
        tokenId: selectedTokenId,
        royaltyPercentage: royaltyPercentage,
        duration: licenseDuration,
        commercialUse: commercialUse,
        terms: JSON.stringify({
          transferable: true,
          commercialAttribution: commercialAttribution,
          commercializerChecker: commercializerChecker,
          commercializerCheckerData: commercializerCheckerData,
          commercialRevShare: commercialRevShare,
          commercialRevCeiling: commercialRevCeiling,
          derivativesAllowed: derivativesAllowed,
          derivativesAttribution: derivativesAttribution,
          derivativesApproval: derivativesApproval,
          derivativesReciprocal: derivativesReciprocal,
          derivativeRevCeiling: derivativeRevCeiling,
          currency: licenseCurrency,
        }),
      }

      // Call backend API
      const response = await fetch(`${BACKEND_URL}/api/license/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId: selectedTokenId,
          royaltyPercentage: royaltyPercentage,
          duration: licenseDuration,
          commercialUse: commercialUse,
          terms: licenseTerms.terms,
          lobosContractAddress: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to mint license')
      }

      const result = await response.json()
      console.log('License minting successful:', result)

      // Show success notification
      if (result.warning) {
        // Handle case where transaction was submitted but hash couldn't be retrieved
        notifySuccess(
          'License Minting Submitted',
          `Your license minting was submitted successfully!\n\n${result.warning}\n\nPlease check your IP asset details to confirm the license was minted.`,
        )
      } else if (result.data?.txHash) {
        notifySuccess(
          'License Minted',
          `Successfully minted license!\nTransaction: ${result.data.txHash}`,
          {
            action: {
              label: 'View Transaction',
              onClick: () =>
                window.open(
                  `https://testnet.bscscan.com/tx/${result.data.txHash}`,
                  '_blank',
                ),
            },
          },
        )
      } else {
        notifySuccess(
          'License Minted',
          `Successfully minted license!${result.message ? '\n' + result.message : ''}`,
        )
      }

      // Reset form
      setSelectedTokenId(1)
      setSelectedLicenseTemplate('custom')
      setRoyaltyPercentage(10)
      setLicenseDuration(86400)
      setCommercialUse(true)
      setCommercialAttribution(true)
      setCommercializerChecker('0x0000000000000000000000000000000000000000')
      setCommercializerCheckerData('0000000000000000000000000000000000000000')
      setCommercialRevShare(100000000)
      setCommercialRevCeiling(0)
      setDerivativesAllowed(true)
      setDerivativesAttribution(true)
      setDerivativesApproval(false)
      setDerivativesReciprocal(true)
      setDerivativeRevCeiling(0)
      setLicenseCurrency('0x15140000000000000000000000000000000000000')

      // Reload data
      await loadContractData()
    } catch (error) {
      console.error('Error minting license:', error)
      notifyError(
        'License Minting Failed',
        error instanceof Error ? error.message : 'Failed to mint license',
      )
    } finally {
      setLoading(false)
    }
  }

  // Calculate and update royalty breakdown when payment amount or token changes
  useEffect(() => {
    if (paymentAmount && parseFloat(paymentAmount) > 0 && paymentTokenId) {
      const breakdown = calculateRoyaltyBreakdown(
        parseFloat(paymentAmount),
        paymentTokenId,
      )
      setRoyaltyBreakdown(breakdown)
    } else {
      setRoyaltyBreakdown(null)
    }
  }, [paymentAmount, paymentTokenId, licenses, ipAssets])

  // Load accumulated royalties when claim token changes
  useEffect(() => {
    if (claimTokenId && account?.address) {
      loadAccumulatedRoyalties(claimTokenId)
    }
  }, [claimTokenId, account?.address])

  // Pay Revenue
  const payRevenue = async () => {
    if (!account?.address || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      notifyError('Invalid Payment', 'Please enter a valid payment amount')
      return
    }

    try {
      setLoading(true)

      // Show breakdown in notification
      if (royaltyBreakdown) {
        const breakdownText = [
          `Total: ${royaltyBreakdown.totalAmount} tBNB`,
          `Platform Fee: ${royaltyBreakdown.platformFee.toFixed(6)} tBNB (2.5%)`,
          ...royaltyBreakdown.licenseRoyalties.map(
            (lr) =>
              `License ${lr.licenseId}: ${lr.amount.toFixed(6)} tBNB (${lr.royaltyPercentage}%)`,
          ),
          `IP Owner: ${royaltyBreakdown.ipOwnerShare.toFixed(6)} tBNB`,
        ].join('\n')
        notifyInfo('Payment Breakdown', breakdownText)
      }

      notifyInfo(
        'Processing Payment',
        `Paying ${paymentAmount} tBNB in revenue...`,
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'payRevenue',
        params: [BigInt(paymentTokenId)],
        value: parseEther(paymentAmount),
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      // Show success notification
      notifySuccess(
        'Payment Successful',
        `Successfully paid ${paymentAmount} tBNB in revenue!`,
      )

      // Reset form
      setPaymentAmount('')
      setPaymentTokenId(1)

      // Reload data
      await loadContractData()
    } catch (error: any) {
      // Check for specific error messages in multiple possible locations
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        error?.cause?.shortMessage ||
        error?.toString() ||
        ''

      // Check if it's a network/RPC error
      const isNetworkError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        (error?.name === 'TypeError' && errorMessage.includes('fetch'))

      if (isNetworkError) {
        console.error('Network error paying revenue:', error)
        notifyError(
          'Network Error',
          'Failed to connect to the blockchain network. Please check your internet connection and try again. If the problem persists, the RPC endpoint may be temporarily unavailable.',
        )
      } else {
        console.error('Error paying revenue:', error)
        notifyError(
          'Payment Failed',
          errorMessage || 'Failed to pay revenue. Please try again.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // Claim Royalties
  const claimRoyalties = async () => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Claiming Royalties', 'Processing royalty claim...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'claimRoyalties',
        params: [BigInt(claimTokenId)],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      // Show success notification with amount
      const claimedAmount = accumulatedRoyalties.get(claimTokenId) || 0n
      notifySuccess(
        'Royalties Claimed',
        `Successfully claimed ${formatEther(claimedAmount)} tBNB!`,
      )

      // Update accumulated royalties
      setAccumulatedRoyalties((prev) => {
        const newMap = new Map(prev)
        newMap.set(claimTokenId, 0n)
        return newMap
      })

      // Reload data
      await loadContractData()

      // Reload accumulated royalties
      if (claimTokenId) {
        await loadAccumulatedRoyalties(claimTokenId)
      }
    } catch (error: any) {
      // Check for specific error messages in multiple possible locations
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        error?.cause?.shortMessage ||
        error?.toString() ||
        ''

      // Check if the error is about no royalties available
      const isNoRoyaltiesError =
        errorMessage.includes('No royalties to claim') ||
        errorMessage.includes('No royalties available') ||
        errorMessage.includes('No balance to claim') ||
        (errorMessage.includes('revert') &&
          errorMessage.includes('No royalties'))

      if (isNoRoyaltiesError) {
        notifyWarning(
          'No Royalties Available',
          'There are no royalties available to claim for this IP asset.',
        )
      } else {
        console.error('Error claiming royalties:', error)
        notifyError(
          'Claim Failed',
          errorMessage || 'Failed to claim royalties. Please try again.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // Arbitration Functions
  const raiseDispute = async () => {
    if (!account?.address || !disputeReason.trim()) {
      notifyError('Invalid Input', 'Please enter a dispute reason')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Raising Dispute', 'Submitting dispute...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'raiseDispute',
        params: [BigInt(disputeTokenId), disputeReason],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      // Get the next dispute ID (it will be the new dispute's ID)
      const nextDisputeId = await readContract({
        contract,
        method: 'nextDisputeId',
        params: [],
      })
      const newDisputeId = Number(nextDisputeId) - 1 // The dispute ID that was just created

      // Reload data
      await loadArbitrationData()
      await loadContractData()

      notifySuccess(
        'Dispute Raised',
        `Dispute #${newDisputeId} has been successfully raised! You can see it in the disputes list below.`,
      )
      setDisputeReason('')
    } catch (error: any) {
      console.error('Error raising dispute:', error)
      notifyError('Dispute Failed', error?.message || 'Failed to raise dispute')
    } finally {
      setLoading(false)
    }
  }

  const registerArbitrator = async () => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Registering Arbitrator',
        `Registering with ${minArbitratorStake} tBNB stake...`,
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'registerArbitrator',
        params: [],
        value: parseEther(minArbitratorStake),
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Arbitrator Registered',
        'Successfully registered as an arbitrator!',
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error registering arbitrator:', error)
      notifyError(
        'Registration Failed',
        error?.message || 'Failed to register as arbitrator',
      )
    } finally {
      setLoading(false)
    }
  }

  const unstakeArbitrator = async () => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)

      // Check arbitrator status before unstaking
      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Get arbitrator details
      const arbitratorDetails = await readContract({
        contract,
        method: 'getArbitrator',
        params: [account.address],
      })

      const stake = arbitratorDetails[1]
      const isActive = arbitratorDetails[5]

      if (!isActive || stake === 0n) {
        notifyError(
          'Not Registered',
          'You are not registered as an active arbitrator or have no stake to withdraw.',
        )
        return
      }

      // Check active disputes
      let activeDisputes = 0
      try {
        const activeDisputesCount = await readContract({
          contract,
          method: 'getArbitratorActiveDisputes',
          params: [account.address],
        })
        activeDisputes = Number(activeDisputesCount)
      } catch (e: any) {
        // If function doesn't exist, calculate manually
        const arb = arbitratorsMap.get(account.address)
        activeDisputes = arb?.activeDisputes || 0
      }

      if (activeDisputes > 0) {
        notifyError(
          'Active Disputes',
          `Cannot unstake while assigned to ${activeDisputes} active dispute(s). Please wait for disputes to be resolved.`,
        )
        return
      }

      notifyInfo(
        'Unstaking Arbitrator',
        `Withdrawing ${formatEther(stake)} tBNB stake...`,
      )

      const preparedCall = await prepareContractCall({
        contract,
        method: 'unstake',
        params: [],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Stake Withdrawn',
        `Successfully withdrew ${formatEther(stake)} tBNB! You are no longer an active arbitrator.`,
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error unstaking arbitrator:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to unstake'

      if (
        errorMessage.includes(
          'Cannot unstake while assigned to active disputes',
        )
      ) {
        notifyError(
          'Active Disputes',
          'Cannot unstake while assigned to active disputes. Please wait for disputes to be resolved.',
        )
      } else if (errorMessage.includes('Not registered as arbitrator')) {
        notifyError(
          'Not Registered',
          'You are not registered as an arbitrator.',
        )
      } else if (errorMessage.includes('No stake to withdraw')) {
        notifyError('No Stake', 'You have no stake to withdraw.')
      } else {
        notifyError('Unstake Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const assignArbitrators = async (
    disputeId: number,
    selectedArbitrators: string[],
  ) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    if (selectedArbitrators.length === 0) {
      notifyError('Invalid Selection', 'Please select at least one arbitrator')
      return
    }

    if (selectedArbitrators.length > 3) {
      notifyError('Invalid Selection', 'Maximum 3 arbitrators can be assigned')
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Assigning Arbitrators',
        `Assigning ${selectedArbitrators.length} arbitrator(s) to dispute...`,
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'assignArbitrators',
        params: [BigInt(disputeId), selectedArbitrators],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Arbitrators Assigned',
        `${selectedArbitrators.length} arbitrator(s) have been assigned to dispute #${disputeId}!`,
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error assigning arbitrators:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to assign arbitrators'

      if (errorMessage.includes('Arbitrators already assigned')) {
        notifyError(
          'Already Assigned',
          'This dispute already has arbitrators assigned.',
        )
      } else if (errorMessage.includes('Arbitrator not active')) {
        notifyError(
          'Invalid Arbitrator',
          'One or more selected arbitrators are not active.',
        )
      } else {
        notifyError('Assignment Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const checkAndResolveArbitration = async (disputeId: number) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    if (!isOwner) {
      notifyError(
        'Unauthorized',
        'Only the contract owner can manually trigger resolution.',
      )
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Checking Resolution',
        'Checking if dispute can be resolved after 24h wait period...',
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'checkAndResolveArbitration',
        params: [BigInt(disputeId)],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Dispute Resolved',
        'Dispute has been resolved after 24 hour waiting period!',
      )
      await loadArbitrationData()
      await loadContractData()
    } catch (error: any) {
      console.error('Error checking and resolving arbitration:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to resolve dispute'

      if (errorMessage.includes('Minimum uphold votes not reached')) {
        notifyError(
          'Not Enough Votes',
          'At least 3 uphold votes are required to resolve.',
        )
      } else if (errorMessage.includes('24 hour waiting period not passed')) {
        notifyError(
          'Waiting Period',
          '24 hours have not passed since 3 uphold votes were reached.',
        )
      } else if (
        errorMessage.includes('Three uphold votes timestamp not set')
      ) {
        notifyError(
          'No Timestamp',
          'Three uphold votes have not been reached yet.',
        )
      } else {
        notifyError('Resolution Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const transferIP = async (tokenId: number, recipient: string) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    if (!recipient || !recipient.trim()) {
      notifyError('Invalid Recipient', 'Please enter a recipient address')
      return
    }

    // Basic address validation
    if (!recipient.startsWith('0x') || recipient.length !== 42) {
      notifyError(
        'Invalid Address',
        'Please enter a valid Ethereum address (0x...)',
      )
      return
    }

    // Check if user owns the token
    const asset = ipAssets.get(tokenId)
    if (!asset) {
      notifyError('Token Not Found', 'IP asset not found')
      return
    }

    if (asset.owner.toLowerCase() !== account.address.toLowerCase()) {
      notifyError('Not Owner', 'You are not the owner of this IP asset')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Transferring IP', 'Initiating IP asset transfer...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Check for active disputes first
      try {
        const hasActive = await readContract({
          contract,
          method: 'hasActiveDisputes',
          params: [BigInt(tokenId)],
        })
        if (hasActive) {
          // Get all disputes for this token to show details
          try {
            const disputeIds = await readContract({
              contract,
              method: 'getTokenDisputes',
              params: [BigInt(tokenId)],
            })

            const unresolvedDisputes: number[] = []
            for (const disputeId of disputeIds) {
              try {
                const dispute = await readContract({
                  contract,
                  method: 'getDispute',
                  params: [BigInt(disputeId)],
                })
                if (!dispute[5]) {
                  // isResolved is at index 5
                  unresolvedDisputes.push(Number(disputeId))
                }
              } catch (e) {
                console.error(`Error fetching dispute ${disputeId}:`, e)
              }
            }

            if (unresolvedDisputes.length > 0) {
              notifyError(
                'Active Disputes',
                `Cannot transfer IP asset. There are ${unresolvedDisputes.length} unresolved dispute(s): ${unresolvedDisputes.join(', ')}. Please resolve all disputes first.`,
              )
            } else {
              notifyError(
                'Active Disputes',
                'Cannot transfer IP asset with active disputes. Please resolve all disputes first.',
              )
            }
          } catch (e) {
            console.error('Error fetching dispute details:', e)
            notifyError(
              'Active Disputes',
              'Cannot transfer IP asset with active disputes. Please resolve all disputes first.',
            )
          }
          setLoading(false)
          return
        }
      } catch (e) {
        console.error('Error checking active disputes:', e)
        // If the check itself fails, we should still try to proceed
        // but the contract will revert if there are active disputes
      }

      const preparedCall = await prepareContractCall({
        contract,
        method: 'transferIP',
        params: [BigInt(tokenId), recipient as `0x${string}`],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Transfer Successful',
        `IP asset #${tokenId} has been transferred to ${recipient.substring(0, 10)}...${recipient.substring(recipient.length - 8)}`,
      )
      await loadContractData()
    } catch (error: any) {
      console.error('Error transferring IP:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to transfer IP asset'

      if (
        errorMessage.includes('Cannot transfer IP with active disputes') ||
        errorMessage.includes('active disputes')
      ) {
        notifyError(
          'Active Disputes',
          'This IP asset has active disputes. Please resolve them before transferring.',
        )
      } else if (errorMessage.includes('Not the owner')) {
        notifyError('Not Owner', 'You are not the owner of this IP asset.')
      } else if (errorMessage.includes('Token does not exist')) {
        notifyError('Token Not Found', 'IP asset does not exist.')
      } else {
        notifyError('Transfer Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const resolveDisputeWithoutArbitrators = async (disputeId: number) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Resolving Dispute',
        'Resolving dispute without arbitrators...',
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'resolveDisputeWithoutArbitrators',
        params: [BigInt(disputeId)],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Dispute Resolved',
        'Dispute has been auto-rejected due to no arbitrators available.',
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error resolving dispute:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to resolve dispute'

      // Check for specific error messages
      if (
        errorMessage.includes('Only the dispute author can resolve') ||
        errorMessage.includes('dispute author')
      ) {
        notifyError(
          'Authorization Failed',
          'Only the person who raised the dispute can resolve it when no arbitrators are available.',
        )
      } else if (errorMessage.includes('Deadline not passed')) {
        notifyError(
          'Deadline Not Passed',
          'The 7-day deadline has not yet passed. Please wait until after the deadline.',
        )
      } else if (errorMessage.includes('Arbitrators already assigned')) {
        notifyError(
          'Arbitrators Assigned',
          'This dispute already has arbitrators assigned. Use the normal arbitration process.',
        )
      } else {
        notifyError('Resolution Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const submitArbitrationDecision = async (disputeId: number) => {
    if (!account?.address || !arbitrationResolution.trim()) {
      notifyError('Invalid Input', 'Please enter a resolution statement')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Submitting Decision', 'Submitting arbitration decision...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'submitArbitrationDecision',
        params: [BigInt(disputeId), arbitrationDecision, arbitrationResolution],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Decision Submitted',
        'Your arbitration decision has been submitted!',
      )
      setArbitrationResolution('')
      await loadArbitrationData()
      await loadContractData()
    } catch (error: any) {
      console.error('Error submitting decision:', error)
      notifyError(
        'Submission Failed',
        error?.message || 'Failed to submit arbitration decision',
      )
    } finally {
      setLoading(false)
    }
  }

  const loadArbitrationData = async () => {
    if (!account?.address) return

    try {
      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Load minimum stake with error handling
      try {
        const minStake = await readContract({
          contract,
          method: 'MIN_ARBITRATOR_STAKE',
          params: [],
        })
        setMinArbitratorStake(formatEther(minStake))
        console.log('✅ Loaded MIN_ARBITRATOR_STAKE:', formatEther(minStake))
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'MIN_ARBITRATOR_STAKE' not available. Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading MIN_ARBITRATOR_STAKE:', errorMessage)
        }
        // Set a default minimum stake (e.g., 0.1 ETH)
        setMinArbitratorStake('0.1')
      }

      // Load active arbitrator count with error handling
      try {
        const activeCount = await readContract({
          contract,
          method: 'getActiveArbitratorsCount',
          params: [],
        })
        setActiveArbitratorsCount(Number(activeCount))
        console.log('✅ Loaded active arbitrators count:', Number(activeCount))
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'getActiveArbitratorsCount' not available. Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn(
            '⚠️ Error loading getActiveArbitratorsCount:',
            errorMessage,
          )
        }
        setActiveArbitratorsCount(0)
      }

      // Load all arbitrators with error handling
      let arbitratorAddresses: readonly `0x${string}`[] = []
      try {
        const result = await readContract({
          contract,
          method: 'getAllArbitrators',
          params: [],
        })
        // Type assertion: readContract returns address[] which we cast to 0x${string}[]
        // This is safe because all Ethereum addresses start with 0x
        arbitratorAddresses = result as readonly `0x${string}`[]
        // Convert to mutable string array for state (string[] is compatible)
        setAllArbitrators(Array.from(arbitratorAddresses))
        console.log('✅ Loaded arbitrators:', arbitratorAddresses.length)
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'getAllArbitrators' not available. Using empty array.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading getAllArbitrators:', errorMessage)
        }
        setAllArbitrators([])
      }

      // Load arbitrator details
      const arbitratorDetails = new Map<string, any>()
      for (const addr of arbitratorAddresses) {
        try {
          const details = await readContract({
            contract,
            method: 'getArbitrator',
            params: [addr],
          })

          // Try to get active disputes count from contract function
          let activeDisputes = 0
          try {
            const activeDisputesCount = await readContract({
              contract,
              method: 'getArbitratorActiveDisputes',
              params: [addr],
            })
            activeDisputes = Number(activeDisputesCount)
          } catch (e: any) {
            // Function doesn't exist or reverts - we'll calculate it manually below
            const errorMsg = e?.message || e?.shortMessage || String(e || '')
            const errorCode = e?.code
            const isExpectedError =
              errorMsg.includes('zero data') ||
              errorMsg.includes('Cannot decode') ||
              errorMsg.includes('AbiDecodingZeroDataError') ||
              errorMsg.includes('execution reverted') ||
              errorCode === 3

            if (!isExpectedError) {
              console.warn(
                `⚠️ Unexpected error loading active disputes for ${addr}:`,
                errorMsg,
              )
            }
            // Will calculate manually below
            activeDisputes = -1 // Use -1 as marker to calculate manually
          }

          arbitratorDetails.set(addr, {
            arbitrator: details[0],
            stake: details[1],
            reputation: details[2],
            totalCases: details[3],
            successfulCases: details[4],
            isActive: details[5],
            registrationDate: details[6],
            activeDisputes: activeDisputes, // Will be updated below if -1
          })
        } catch (e: any) {
          // Silently handle zero data errors
          const errorMsg = e?.message || e?.shortMessage || String(e || '')
          const isZeroDataError =
            errorMsg.includes('zero data') ||
            errorMsg.includes('Cannot decode') ||
            errorMsg.includes('AbiDecodingZeroDataError')

          if (!isZeroDataError) {
            console.error(`Error loading arbitrator ${addr}:`, e)
          }
        }
      }
      setArbitratorsMap(arbitratorDetails)

      // Load all disputes with error handling
      let nextDisputeIdNum = 1
      try {
        const nextDisputeId = await readContract({
          contract,
          method: 'nextDisputeId',
          params: [],
        })
        nextDisputeIdNum = Number(nextDisputeId)
        console.log('✅ Loaded nextDisputeId:', nextDisputeIdNum)
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'nextDisputeId' not available. Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading nextDisputeId:', errorMessage)
        }
        // Use default value of 1 (no disputes registered yet)
        nextDisputeIdNum = 1
      }

      const disputesData = new Map<number, any>()
      for (let i = 1; i < nextDisputeIdNum; i++) {
        try {
          const dispute = await readContract({
            contract,
            method: 'getDispute',
            params: [BigInt(i)],
          })
          disputesData.set(i, {
            disputeId: Number(dispute[0]),
            tokenId: Number(dispute[1]),
            disputer: dispute[2],
            reason: dispute[3],
            timestamp: dispute[4],
            isResolved: dispute[5],
            arbitrationId: Number(dispute[6]),
          })
        } catch (e) {
          // Dispute doesn't exist, skip
          console.error(`Error loading dispute ${i}:`, e)
        }
      }
      setDisputesMap(disputesData)

      // Load arbitration details for all disputes (both resolved and unresolved)
      // We need this to calculate active disputes per arbitrator
      const arbitrationsData = new Map<number, any>()
      for (const [, dispute] of disputesData.entries()) {
        // Load arbitration if it exists (disputes with assigned arbitrators have arbitrationId > 0)
        if (dispute.arbitrationId > 0) {
          try {
            const arbitration = await readContract({
              contract,
              method: 'getArbitration',
              params: [BigInt(dispute.arbitrationId)],
            })
            arbitrationsData.set(dispute.arbitrationId, {
              arbitrationId: Number(arbitration[0]),
              disputeId: Number(arbitration[1]),
              arbitrators: arbitration[2],
              votesFor: Number(arbitration[3]),
              votesAgainst: Number(arbitration[4]),
              deadline: arbitration[5],
              isResolved: arbitration[6],
              resolution: arbitration[7],
              threeUpholdVotesTimestamp: arbitration[8],
            })
          } catch (e) {
            // Silently handle errors - arbitration might not exist yet
            console.log(
              `ℹ️ Arbitration ${dispute.arbitrationId} not available yet`,
            )
          }
        }
      }
      setArbitrationsMap(arbitrationsData)

      // Calculate active disputes per arbitrator manually (workaround when getArbitratorActiveDisputes doesn't work)
      // This counts unresolved disputes where the arbitrator is assigned
      for (const [addr, arbitratorInfo] of arbitratorDetails.entries()) {
        if (arbitratorInfo.activeDisputes === -1) {
          // Calculate manually by counting unresolved disputes where this arbitrator is assigned
          let count = 0
          for (const [, dispute] of disputesData.entries()) {
            if (!dispute.isResolved && dispute.arbitrationId > 0) {
              const arbitration = arbitrationsData.get(dispute.arbitrationId)
              if (arbitration && arbitration.arbitrators) {
                // Check if this arbitrator is in the arbitrators list
                const isAssigned = arbitration.arbitrators.some(
                  (arbAddr: string) =>
                    arbAddr.toLowerCase() === addr.toLowerCase(),
                )
                if (isAssigned && !arbitration.isResolved) {
                  count++
                }
              }
            }
          }
          arbitratorInfo.activeDisputes = count
          if (count > 0) {
            console.log(
              `✅ Calculated ${count} active dispute(s) for arbitrator ${addr.substring(0, 10)}...`,
            )
          }
        }
      }

      // Load contract owner with error handling
      try {
        const ownerAddress = await readContract({
          contract,
          method: 'owner',
          params: [],
        })
        setIsOwner(
          account?.address?.toLowerCase() === ownerAddress.toLowerCase(),
        )
        console.log('✅ Loaded contract owner:', ownerAddress)
      } catch (e: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage = e?.message || e?.shortMessage || String(e || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'owner' not available. Assuming user is not the owner.",
          )
          setIsOwner(false) // Default to false if we can't determine
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading contract owner:', errorMessage)
          setIsOwner(false) // Default to false on error
        }
      }
    } catch (error: any) {
      // Only log unexpected errors, not zero data errors
      const errorMessage =
        error?.message || error?.shortMessage || String(error || '')
      const isZeroDataError =
        errorMessage.includes('zero data') ||
        errorMessage.includes('Cannot decode') ||
        errorMessage.includes('AbiDecodingZeroDataError')

      if (!isZeroDataError) {
        console.error('Error loading arbitration data:', error)
      } else {
        console.log(
          'ℹ️ Some arbitration contract functions returned zero data (expected for new contracts). Continuing with defaults.',
        )
      }
    }
  }

  // Load arbitration data on mount
  useEffect(() => {
    if (account?.address) {
      loadArbitrationData()
    }
  }, [account?.address])

  // Show landing page until wallet is connected
  if (!account?.address) {
    return <BluvfiLandingPage />

    return (
      <div className="app Bluvfi-app-shell">
        <NotificationToasts />

        <header className="Bluvfi-nav">
          <div className="Bluvfi-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="Bluvfi-logo" />
            <span>Bluvfi</span>
          </div>
          <nav className="Bluvfi-links" aria-label="Primary">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#circle">Circle</a>
            <a href="#setup">Setup</a>
          </nav>
          <a className="Bluvfi-nav-cta" href="#waitlist">
            Join waitlist
          </a>
        </header>

        <main className="landing-redesign">
          <section className="Bluvfi-hero">
            <div className="Bluvfi-hero-copy">
              <p className="Bluvfi-kicker">Your AI assistant, on a leash 🐕</p>
              <h1 className="Bluvfi-title">
                Let your AI assistant do the work, without giving it the keys to everything.
              </h1>
              <p className="Bluvfi-subtitle">
                Bluvfi is like a babysitter for your AI assistant. You tell it exactly what it's allowed to do, how much it can spend, and for how long. It does the job. You stay in charge.
              </p>
              <div className="Bluvfi-actions">
                <a
                  className="Bluvfi-primary-btn"
                  href="#waitlist"
                >
                  Get early access
                </a>
                <a className="Bluvfi-secondary-btn" href="#sessions">
                  See how it works
                </a>
              </div>
              <div className="Bluvfi-trust-row" aria-label="Product highlights">
                <span>✅ You stay in control</span>
                <span>⚡ AI does the work</span>
                <span>🔒 Nothing sneaks past</span>
              </div>
            </div>

            <div
              className="Bluvfi-console-stage"
              aria-label="Bluvfi workflow preview"
            >
              <div className="Bluvfi-console">
                <div className="phone-topbar">
                  <span>AI assistant session</span>
                  <span>LIVE</span>
                </div>
                <div className="balance-card">
                  <span>Spending limit you set</span>
                  <strong>$25</strong>
                  <small>
                    Your helper can only spend this much. Not a penny more.
                  </small>
                </div>
                <div className="quick-actions">
                  <span>Allow</span>
                  <span>Run</span>
                  <span>Stop</span>
                </div>
                <div className="activity-card deposit">
                  <div>
                    <span>Bought market data</span>
                    <p>AI paid for info it needed</p>
                  </div>
                  <strong>✅ Done</strong>
                </div>
                <div className="activity-card">
                  <div>
                    <span>Made a swap</span>
                    <p>Only the route you approved</p>
                  </div>
                  <strong>✅ Allowed</strong>
                </div>
              </div>
              <div className="floating-receipt">
                <span>Your main wallet never touched</span>
                <strong>Session ends in 18 min</strong>
              </div>
            </div>
          </section>

          <section id="sessions" className="Bluvfi-section Bluvfi-split">
            <div>
              <p className="Bluvfi-kicker">
                Your AI assistant, your rules
              </p>
              <h2>
                Give your AI assistant a job to do, then watch it do exactly that. Nothing else.
              </h2>
              <p>
                Think of Bluvfi like giving a kid an allowance. You say "here's $5, you can only buy snacks, and only until 5pm." They can't raid your wallet or go somewhere you didn't approve. Your AI assistant works the same way. You set the rules, Bluvfi enforces them automatically.
              </p>
            </div>
            <div className="chain-panel">
              {[
                ['Connect your wallet', 'You own it'],
                ['Tell it what it can do', 'Your rules'],
                ['Let it get to work', 'Auto-pilot'],
                ['Every step is checked', 'Nothing sneaks by'],
              ].map(([label, status]) => (
                <div className="chain-row" key={label}>
                  <span>{label}</span>
                  <strong>{status}</strong>
                </div>
              ))}
            </div>
          </section>

          <section id="execution" className="Bluvfi-section">
            <div className="section-intro">
              <p className="Bluvfi-kicker">How it works in 3 steps</p>
              <h2>Simple as 1, 2, 3.</h2>
            </div>
            <div className="payment-grid">
              <article className="payment-card">
                <span className="payment-icon">01</span>
                <h3>You say what's allowed</h3>
                <p>
                  Pick which apps your AI can use, how much it can spend, and set a time limit. Like giving someone a permission slip.
                </p>
                <div className="mini-ledger">
                  <span>Set rules once</span>
                  <strong>Locked in</strong>
                </div>
              </article>

              <article className="payment-card scan-card">
                <span className="payment-icon">02</span>
                <h3>Your AI pays its own way</h3>
                <p>
                  When your AI assistant needs to buy something (like data or a tool), it pays automatically. Always within the budget you set.
                </p>
                <div className="qr-box" aria-label="QR payment scan preview">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        index % 3 === 0 || index % 7 === 0 ? 'active' : ''
                      }
                    ></span>
                  ))}
                </div>
                <small>Payment confirmed ✅</small>
              </article>

              <article className="payment-card conversion-card">
                <span className="payment-icon">03</span>
                <h3>Jobs get done, you stay safe</h3>
                <p>
                  Your AI finishes the task. When time's up or money runs out, it stops automatically. Your main account is never touched.
                </p>
                <div className="rate-ticket">
                  <span>Task complete</span>
                  <strong>All safe 🔒</strong>
                </div>
              </article>
            </div>
          </section>

          <section id="security" className="Bluvfi-section benefit-band">
            {[
              '🔐 Your main wallet is never exposed',
              '🛑 AI stops automatically when time runs out',
              '💸 Payments only go where you approved',
              '⚡ Cancel anytime with one click',
            ].map((benefit) => (
              <div className="benefit-item" key={benefit}>
                <span></span>
                <p>{benefit}</p>
              </div>
            ))}
          </section>

          {/* FAQ Section */}
          <section id="faq" className="Bluvfi-section">
            <div style={{ maxWidth: "720px", margin: "0 auto", width: "100%" }}>
              <p className="Bluvfi-kicker">Got questions?</p>
              <h2 style={{ marginBottom: "2rem" }}>Simple answers to simple questions</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    q: "What is Bluvfi, in plain English?",
                    a: "Bluvfi is a way to let an AI assistant do tasks for you (like buying data, making swaps, or running jobs) without giving it access to everything in your wallet. You stay in charge the whole time."
                  },
                  {
                    q: "Is my money safe?",
                    a: "Yes. You set a spending limit before anything starts. The AI can only spend up to that amount, in the places you approve, before the time you set runs out. Your main wallet is never touched."
                  },
                  {
                    q: "How is this different from just using an AI chatbot?",
                    a: "A chatbot talks to you. Bluvfi lets your AI actually do things (like make payments or run tasks), but only within the rules you set first. It's the difference between asking for directions and actually driving the car for you, safely."
                  },
                  {
                    q: "Can I stop the AI anytime?",
                    a: "Yes! You can cancel at any moment. Sessions also stop automatically when time runs out or the spending limit is hit. You're always in control."
                  },
                  {
                    q: "Is Bluvfi ready to use right now?",
                    a: "Bluvfi is being built right now. Join the waitlist below to be first in line when we open up access, and to get updates as we ship new features."
                  },
                ].map((item, index) => (
                  <details
                    key={index}
                    style={{
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <summary style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      listStyle: "none",
                      WebkitAppearance: "none",
                    }}>
                      {item.q}
                      <span style={{ fontSize: "1.2rem" }}>+</span>
                    </summary>
                    <p style={{
                      marginTop: "0.75rem",
                      fontSize: "15px",
                      lineHeight: "1.6",
                      color: "rgba(0,0,0,0.7)",
                    }}>
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section id="waitlist" className="Bluvfi-section waitlist-section">
            <p className="Bluvfi-kicker">
              Be first in line 🚀
            </p>
            <h2>
              Want your AI assistant to get things done while you sleep?
            </h2>
            <p>
              Join the waitlist and we'll let you know the moment Bluvfi is ready. No spam. Just one email when it's your turn.
            </p>
            <TallyEmbed />
          </section>

          <footer className="Bluvfi-footer">
            <div className="Bluvfi-brand">
              <img
                src="/Bluvfiv2.jpg"
                alt="Bluvfi logo"
                className="Bluvfi-logo"
              />
              <span>Bluvfi</span>
            </div>
            <div className="footer-links">
              <a
                href="https://x.com/bluvfi"
                target="_blank"
                rel="noopener noreferrer"
              >
                X / Twitter
              </a>
              <a
                href="https://t.me/+KXpDSUAnfg44MTg0"
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
              <a href="/aml">AML Policy</a>
              <a href="/cookies">Cookie Policy</a>
            </div>
            <p>Open source. Built so AI can work for you, safely.</p>
          </footer>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Toast Notifications */}
      <NotificationToasts />

      {/* Modern Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-logo">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="logo-image" />
            <h1>Bluvfi</h1>
          </div>
          <div className="header-actions">
            <div
              className={`status-indicator ${backendStatus ? 'connected' : 'disconnected'}`}
            >
              <span className="status-dot"></span>
              <span>
                Backend {backendStatus ? 'Connected' : 'Disconnected'}
              </span>
              <button onClick={checkBackendStatus} className="refresh-btn">
                🔄
              </button>
            </div>
            <NotificationButton />
            <ConnectButton
              client={thirdwebClient}
              wallets={wallets}
              chain={defineChain(bnbChain.id)}
            />
          </div>
        </div>
      </header>

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Processing your request...</p>
        </div>
      )}

      <div className="main-content">
        {/* Dashboard Navigation */}
        <div className="dashboard-nav">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`nav-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            📝 Register IP
          </button>
          <button
            className={`nav-tab ${activeTab === 'license' ? 'active' : ''}`}
            onClick={() => setActiveTab('license')}
          >
            🎫 License Management
          </button>
          <button
            className={`nav-tab ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveTab('revenue')}
          >
            💰 Revenue & Analytics
          </button>
          <button
            className={`nav-tab ${activeTab === 'arbitration' ? 'active' : ''}`}
            onClick={() => setActiveTab('arbitration')}
          >
            ⚖️ Arbitration
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <IPPortfolio
              assets={ipAssets}
              licenses={licenses}
              metadata={parsedMetadata}
              userAddress={account?.address}
              onTransferIP={transferIP}
            />
          )}

          {/* Register IP Tab */}
          {activeTab === 'register' && (
            <section className="section section-wide">
              <div className="section-header">
                <span className="section-icon">📝</span>
                <h2 className="section-title">Register IP Asset</h2>
              </div>

              <div className="form-grid">
                {/* File Upload */}
                <div
                  className="file-upload-area"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="ip-file-upload"
                    className="file-upload-input"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4"
                  />
                  <div className="file-upload-content">
                    <div className="file-upload-icon">📎</div>
                    <div className="file-upload-text">
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div className="file-upload-hint">
                      PDF, DOC, TXT, JPG, PNG, GIF, MP3, WAV, MP4 (max 50MB)
                    </div>
                  </div>
                </div>

                {filePreview && (
                  <div className="file-preview animate-slide-up">
                    {filePreview.startsWith('data:image') ? (
                      <img
                        src={filePreview}
                        alt="File preview"
                        className="file-preview-image"
                      />
                    ) : (
                      <div className="file-preview-image">📄</div>
                    )}
                    <div className="file-preview-info">
                      <div className="file-preview-name">{ipFile?.name}</div>
                      <div className="file-preview-size">
                        {ipFile
                          ? `${(ipFile.size / 1024 / 1024).toFixed(2)} MB`
                          : ''}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-secondary btn-full"
                  onClick={uploadToIPFS}
                  disabled={!ipFile || loading}
                >
                  {loading ? '⏳ Uploading...' : '🚀 Upload to IPFS'}
                </button>
                {/* IP Details Form */}
                <div className="form-group">
                  <label className="form-label">🔗 IP Hash (IPFS)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ipHash}
                    onChange={(e) => setIpHash(e.target.value)}
                    placeholder="IPFS hash will appear after upload"
                    readOnly
                  />
                </div>

                {ipHash && (
                  <div className="media-preview animate-scale-in">
                    <div className="media-container">
                      {ipFile && ipFile.type.startsWith('image/') ? (
                        <img
                          src={getIPFSGatewayURL(ipHash)}
                          alt="Uploaded media"
                          className="media-image"
                          onError={(e) => {
                            const imgElement = e.target as HTMLImageElement
                            imgElement.style.display = 'none'
                            const fallback =
                              imgElement.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="media-fallback"
                        style={{
                          display: ipFile?.type.startsWith('image/')
                            ? 'none'
                            : 'flex',
                        }}
                      >
                        <div className="media-fallback-icon">📄</div>
                        <p>Media Preview</p>
                        <a
                          href={getIPFSGatewayURL(ipHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="media-link"
                        >
                          🔗 View Media
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">📝 Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={ipName}
                      onChange={(e) => setIpName(e.target.value)}
                      placeholder="Enter a name for your IP asset"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">🔒 Security</label>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={isEncrypted}
                        onChange={(e) => setIsEncrypted(e.target.checked)}
                      />
                      <label className="checkbox-label">
                        Encrypted Content
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">📄 Description</label>
                  <textarea
                    className="form-input form-textarea"
                    value={ipDescription}
                    onChange={(e) => setIpDescription(e.target.value)}
                    placeholder="Describe your IP asset"
                    rows={3}
                  />
                </div>

                <button
                  className="btn btn-primary btn-full"
                  onClick={registerIP}
                  disabled={
                    loading || !account?.address || !ipHash || !ipName.trim()
                  }
                >
                  {loading ? '⏳ Registering...' : '🚀 Register IP Asset'}
                </button>
              </div>
            </section>
          )}

          {/* License Management Tab */}
          {activeTab === 'license' && (
            <section className="section">
              <div className="section-header">
                <span className="section-icon">🎫</span>
                <h2 className="section-title">Mint License</h2>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">🎯 Select IP Asset</label>
                  <select
                    className="form-select"
                    value={selectedTokenId}
                    onChange={(e) => setSelectedTokenId(Number(e.target.value))}
                  >
                    {Array.from(ipAssets.keys()).map((id) => {
                      const asset = ipAssets.get(id)
                      const metadata = parsedMetadata.get(id) || {
                        name: 'Unknown',
                      }
                      return (
                        <option key={id} value={id}>
                          #{id} -{' '}
                          {metadata.name ||
                            asset?.ipHash.substring(0, 10) ||
                            'Unknown'}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* License Template Selector */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <label
                      className="form-label"
                      style={{ margin: 0, flex: 1 }}
                    >
                      📋 License Template
                    </label>
                    {selectedLicenseTemplate !== 'custom' && (
                      <button
                        type="button"
                        onClick={() =>
                          applyLicenseTemplate(selectedLicenseTemplate)
                        }
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          backgroundColor: 'var(--color-secondary, #6c757d)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            'var(--color-secondary-hover, #5a6268)')
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            'var(--color-secondary, #6c757d)')
                        }
                      >
                        🔄 Reset to Template
                      </button>
                    )}
                  </div>
                  <select
                    className="form-select"
                    value={selectedLicenseTemplate}
                    onChange={(e) => applyLicenseTemplate(e.target.value)}
                  >
                    {LICENSE_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.icon} {template.name}
                      </option>
                    ))}
                  </select>
                  {selectedLicenseTemplate !== 'custom' &&
                    (() => {
                      const template = LICENSE_TEMPLATES.find(
                        (t) => t.id === selectedLicenseTemplate,
                      )
                      if (!template) return null

                      // Check if form values match template (to show customization indicator)
                      const isCustomized =
                        royaltyPercentage !== template.royaltyPercentage ||
                        licenseDuration !== template.duration ||
                        commercialUse !== template.commercialUse ||
                        commercialAttribution !==
                          template.commercialAttribution ||
                        derivativesAllowed !== template.derivativesAllowed ||
                        derivativesAttribution !==
                          template.derivativesAttribution ||
                        derivativesApproval !== template.derivativesApproval ||
                        derivativesReciprocal !== template.derivativesReciprocal

                      return (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            backgroundColor: isCustomized
                              ? 'var(--color-warning-bg, #fff3cd)'
                              : 'var(--color-info-bg, #d1ecf1)',
                            border: `1px solid ${
                              isCustomized
                                ? 'var(--color-warning-border, #ffc107)'
                                : 'var(--color-info-border, #0c5460)'
                            }`,
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            color: isCustomized
                              ? 'var(--color-warning-text, #856404)'
                              : 'var(--color-info-text, #0c5460)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <strong>
                              {template.icon} {template.name}
                            </strong>
                            {isCustomized && (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor:
                                    'var(--color-warning, #ffc107)',
                                  color: '#000',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                }}
                              >
                                ✏️ Customized
                              </span>
                            )}
                          </div>
                          <div>{template.description}</div>
                          <div
                            style={{
                              marginTop: '0.5rem',
                              fontSize: '0.8rem',
                              opacity: 0.9,
                            }}
                          >
                            💰 Royalty: {template.royaltyPercentage}% | ⏰
                            Duration: {formatDuration(template.duration)} |
                            {template.commercialUse
                              ? ' 💼 Commercial'
                              : ' 🚫 Non-Commercial'}{' '}
                            |
                            {template.derivativesAllowed
                              ? ' ✏️ Derivatives Allowed'
                              : ' 🔒 No Derivatives'}
                          </div>
                        </div>
                      )
                    })()}
                  <small className="form-hint">
                    Select a predefined template or choose "Custom" to configure
                    manually. Templates can be customized after selection.
                  </small>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">💰 Royalty (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={royaltyPercentage}
                      onChange={(e) =>
                        setRoyaltyPercentage(Number(e.target.value))
                      }
                      min="1"
                      max="100"
                      placeholder="10"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">⏰ Duration (seconds)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={licenseDuration}
                      onChange={(e) =>
                        setLicenseDuration(Number(e.target.value))
                      }
                      min="3600"
                      placeholder="86400"
                    />
                  </div>
                </div>

                {/* License Terms */}
                <div className="form-group">
                  <label className="form-label">⚙️ License Terms</label>
                  <div className="form-grid">
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={commercialUse}
                        onChange={(e) => setCommercialUse(e.target.checked)}
                      />
                      <label className="checkbox-label">
                        Commercial Use Allowed
                      </label>
                    </div>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={commercialAttribution}
                        onChange={(e) =>
                          setCommercialAttribution(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Commercial Attribution
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesAllowed}
                        onChange={(e) =>
                          setDerivativesAllowed(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Allowed
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesAttribution}
                        onChange={(e) =>
                          setDerivativesAttribution(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Attribution
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesApproval}
                        onChange={(e) =>
                          setDerivativesApproval(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Approval Required
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesReciprocal}
                        onChange={(e) =>
                          setDerivativesReciprocal(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Reciprocal
                      </label>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <details className="form-group">
                  <summary
                    className="form-label"
                    style={{ cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔧 Advanced Settings
                  </summary>
                  <div className="form-grid" style={{ marginTop: '1rem' }}>
                    <div className="form-group-row">
                      <div className="form-group">
                        <label className="form-label">
                          💵 Commercial Rev Share (%)
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={commercialRevShare / 1000000}
                          onChange={(e) =>
                            setCommercialRevShare(
                              Number(e.target.value) * 1000000,
                            )
                          }
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="100"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">
                          🏛️ Commercial Rev Ceiling
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={commercialRevCeiling}
                          onChange={(e) =>
                            setCommercialRevCeiling(Number(e.target.value))
                          }
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        🔍 Commercializer Checker
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={commercializerChecker}
                        onChange={(e) =>
                          setCommercializerChecker(e.target.value)
                        }
                        placeholder="0x0000000000000000000000000000000000000000"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        📊 Derivative Rev Ceiling
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={derivativeRevCeiling}
                        onChange={(e) =>
                          setDerivativeRevCeiling(Number(e.target.value))
                        }
                        min="0"
                        placeholder="0"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">💱 License Currency</label>
                      <input
                        type="text"
                        className="form-input"
                        value={licenseCurrency}
                        onChange={(e) => setLicenseCurrency(e.target.value)}
                        placeholder="0x15140000000000000000000000000000000000000"
                      />
                    </div>
                  </div>
                </details>

                <button
                  className="btn btn-primary btn-full"
                  onClick={mintLicense}
                  disabled={loading || !account?.address}
                >
                  {loading ? '⏳ Minting...' : '🎫 Mint License'}
                </button>
              </div>
            </section>
          )}

          {/* Revenue & Analytics Tab */}
          {activeTab === 'revenue' && (
            <>
              {/* Pay Revenue */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">💳</span>
                  <h2 className="section-title">Pay Revenue</h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Select IP Asset</label>
                    <select
                      className="form-select"
                      value={paymentTokenId}
                      onChange={(e) =>
                        setPaymentTokenId(Number(e.target.value))
                      }
                    >
                      {Array.from(ipAssets.keys()).map((id) => {
                        const asset = ipAssets.get(id)
                        const metadata = parsedMetadata.get(id) || {
                          name: 'Unknown',
                        }
                        return (
                          <option key={id} value={id}>
                            #{id} -{' '}
                            {metadata.name ||
                              asset?.ipHash.substring(0, 10) ||
                              'Unknown'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">💰 Amount (tBNB)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      min="0.001"
                      step="0.001"
                      placeholder="0.001"
                    />
                  </div>

                  {/* Royalty Calculation Preview */}
                  {royaltyBreakdown && (
                    <div
                      className="form-group"
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-info-bg, #d1ecf1)',
                          border: '1px solid var(--color-info-border, #0c5460)',
                          borderRadius: '8px',
                          marginTop: '0.5rem',
                        }}
                      >
                        <h3
                          style={{
                            margin: '0 0 1rem 0',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'var(--color-info-text, #0c5460)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          🧮 Automated Royalty Calculation Preview
                        </h3>

                        <div
                          style={{
                            display: 'grid',
                            gap: '0.75rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          {/* Total Payment */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              Total Payment:
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.totalAmount} tBNB
                            </span>
                          </div>

                          {/* Platform Fee */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              🏛️ Platform Fee (2.5%):
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.platformFee.toFixed(6)} tBNB
                            </span>
                          </div>

                          {/* Remaining After Fee */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              borderTop: '1px solid rgba(0,0,0,0.1)',
                              borderBottom: '1px solid rgba(0,0,0,0.1)',
                              marginTop: '0.25rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              💰 Available for Distribution:
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.remainingAfterFee.toFixed(6)}{' '}
                              tBNB
                            </span>
                          </div>

                          {/* License Royalties */}
                          {royaltyBreakdown.licenseRoyalties.length > 0 && (
                            <>
                              <div
                                style={{
                                  marginTop: '0.5rem',
                                  paddingTop: '0.5rem',
                                  borderTop: '1px solid rgba(0,0,0,0.2)',
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: '0.8rem',
                                    opacity: 0.9,
                                    color: '#1e293b',
                                  }}
                                >
                                  License Holder Royalties:
                                </strong>
                              </div>
                              {royaltyBreakdown.licenseRoyalties.map(
                                (lr, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      padding: '0.5rem',
                                      backgroundColor:
                                        'rgba(255, 255, 255, 0.2)',
                                      borderRadius: '4px',
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    <span style={{ color: '#1e293b' }}>
                                      🎫 License #{lr.licenseId} (
                                      {lr.royaltyPercentage}%):
                                      <br />
                                      <span
                                        style={{
                                          fontSize: '0.75rem',
                                          opacity: 0.8,
                                          color: '#1e293b',
                                        }}
                                      >
                                        {lr.licensee.substring(0, 6)}...
                                        {lr.licensee.substring(38)}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 500,
                                        color: '#1e293b',
                                      }}
                                    >
                                      {lr.amount.toFixed(6)} tBNB
                                    </span>
                                  </div>
                                ),
                              )}
                            </>
                          )}

                          {/* IP Owner Share */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.75rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.4)',
                              borderRadius: '4px',
                              marginTop: '0.5rem',
                              fontWeight: 600,
                              borderTop: '2px solid rgba(0,0,0,0.1)',
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              👤 IP Owner Share:
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.ipOwnerShare.toFixed(6)} tBNB
                            </span>
                          </div>

                          {/* Summary */}
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              fontSize: '0.75rem',
                              opacity: 0.8,
                              fontStyle: 'italic',
                              textAlign: 'center',
                              color: '#1e293b',
                            }}
                          >
                            💡 Royalties are automatically calculated and
                            distributed on-chain
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={payRevenue}
                    disabled={
                      loading ||
                      !account?.address ||
                      !paymentAmount ||
                      parseFloat(paymentAmount) <= 0
                    }
                  >
                    {loading ? '⏳ Processing...' : '💳 Pay Revenue'}
                  </button>
                </div>
              </section>

              {/* Claim Royalties */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">🏆</span>
                  <h2 className="section-title">Claim Royalties</h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Select IP Asset</label>
                    <select
                      className="form-select"
                      value={claimTokenId}
                      onChange={(e) => setClaimTokenId(Number(e.target.value))}
                    >
                      {Array.from(ipAssets.keys()).map((id) => {
                        const asset = ipAssets.get(id)
                        const metadata = parsedMetadata.get(id) || {
                          name: 'Unknown',
                        }
                        return (
                          <option key={id} value={id}>
                            #{id} -{' '}
                            {metadata.name ||
                              asset?.ipHash.substring(0, 10) ||
                              'Unknown'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Accumulated Royalties Display */}
                  {account?.address &&
                    accumulatedRoyalties.has(claimTokenId) && (
                      <div
                        className="form-group"
                        style={{ gridColumn: '1 / -1' }}
                      >
                        <div
                          style={{
                            padding: '1rem',
                            backgroundColor:
                              accumulatedRoyalties.get(claimTokenId)! > 0n
                                ? 'var(--color-success-bg, #d4edda)'
                                : 'var(--color-info-bg, #d1ecf1)',
                            border: `1px solid ${
                              accumulatedRoyalties.get(claimTokenId)! > 0n
                                ? 'var(--color-success-border, #28a745)'
                                : 'var(--color-info-border, #0c5460)'
                            }`,
                            borderRadius: '8px',
                            marginTop: '0.5rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '1rem',
                                fontWeight: 600,
                                color:
                                  accumulatedRoyalties.get(claimTokenId)! > 0n
                                    ? '#155724'
                                    : '#0c5460',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              💰 Accumulated Royalties
                            </h3>
                            <span
                              style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color:
                                  accumulatedRoyalties.get(claimTokenId)! > 0n
                                    ? '#155724'
                                    : '#0c5460',
                              }}
                            >
                              {formatEther(
                                accumulatedRoyalties.get(claimTokenId) || 0n,
                              )}{' '}
                              tBNB
                            </span>
                          </div>

                          {accumulatedRoyalties.get(claimTokenId)! > 0n ? (
                            <div
                              style={{
                                fontSize: '0.875rem',
                                color: '#155724',
                                opacity: 0.9,
                              }}
                            >
                              ✅ You have claimable royalties for this IP asset.
                              Click "Claim Royalties" to withdraw.
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: '0.875rem',
                                color: '#0c5460',
                                opacity: 0.9,
                              }}
                            >
                              ℹ️ No accumulated royalties available for this IP
                              asset. Royalties accumulate when revenue is paid
                              to this IP.
                            </div>
                          )}

                          {/* Show license details if user has a license */}
                          {(() => {
                            const userLicenses = Array.from(
                              licenses.entries(),
                            ).filter(
                              ([_, license]) =>
                                Number(license.tokenId) === claimTokenId &&
                                license.licensee.toLowerCase() ===
                                  account?.address.toLowerCase(),
                            )

                            if (userLicenses.length > 0) {
                              return (
                                <div
                                  style={{
                                    marginTop: '0.75rem',
                                    paddingTop: '0.75rem',
                                    borderTop: '1px solid rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <strong
                                    style={{
                                      fontSize: '0.8rem',
                                      color:
                                        accumulatedRoyalties.get(
                                          claimTokenId,
                                        )! > 0n
                                          ? '#155724'
                                          : '#0c5460',
                                    }}
                                  >
                                    Your Licenses:
                                  </strong>
                                  {userLicenses.map(([licenseId, license]) => (
                                    <div
                                      key={licenseId}
                                      style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        backgroundColor:
                                          'rgba(255, 255, 255, 0.3)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      <div style={{ color: '#1e293b' }}>
                                        🎫 License #{licenseId}
                                      </div>
                                      <div
                                        style={{
                                          opacity: 0.8,
                                          marginTop: '0.25rem',
                                          color: '#1e293b',
                                        }}
                                      >
                                        Royalty Rate:{' '}
                                        {Number(license.royaltyPercentage) /
                                          100}
                                        % |
                                        {license.isActive
                                          ? ' ✅ Active'
                                          : ' ❌ Inactive'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                    )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={claimRoyalties}
                    disabled={
                      loading ||
                      !account?.address ||
                      !accumulatedRoyalties.get(claimTokenId) ||
                      accumulatedRoyalties.get(claimTokenId)! === 0n
                    }
                  >
                    {loading ? '⏳ Claiming...' : '🏆 Claim Royalties'}
                  </button>
                </div>
              </section>
            </>
          )}

          {/* Arbitration Tab */}
          {activeTab === 'arbitration' && (
            <>
              {/* Register as Arbitrator */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⚖️</span>
                  <h2 className="section-title">Register as Arbitrator</h2>
                </div>

                <div className="form-grid">
                  {(() => {
                    const userArbitrator = account?.address
                      ? arbitratorsMap.get(account.address)
                      : null
                    const isUserArbitrator =
                      userArbitrator &&
                      userArbitrator.arbitrator !==
                        '0x0000000000000000000000000000000000000000'
                    const userStake = userArbitrator ? userArbitrator.stake : 0n
                    const userActiveDisputes =
                      userArbitrator?.activeDisputes || 0
                    const userIsActive = userArbitrator?.isActive || false

                    if (isUserArbitrator && userIsActive && userStake > 0n) {
                      return (
                        <>
                          <div
                            className="form-group"
                            style={{ gridColumn: '1 / -1' }}
                          >
                            <div
                              style={{
                                padding: '1rem',
                                backgroundColor:
                                  'var(--color-info-bg, #d1ecf1)',
                                border:
                                  '1px solid var(--color-info-border, #0c5460)',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                color: 'var(--color-info-text, #0c5460)',
                              }}
                            >
                              <strong>ℹ️ Your Arbitrator Status:</strong>
                              <div style={{ marginTop: '0.5rem' }}>
                                <div>
                                  💰 Stake: {formatEther(userStake)} tBNB
                                </div>
                                <div>
                                  ⚖️ Active Disputes: {userActiveDisputes}
                                </div>
                                <div>✅ Status: Active</div>
                                {userActiveDisputes > 0 && (
                                  <div
                                    style={{
                                      marginTop: '0.5rem',
                                      color: 'var(--color-warning, #ffc107)',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    ⚠️ You cannot unstake while assigned to
                                    active disputes.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            className="btn btn-danger btn-full"
                            onClick={unstakeArbitrator}
                            disabled={
                              loading ||
                              !account?.address ||
                              userActiveDisputes > 0
                            }
                          >
                            {loading
                              ? '⏳ Unstaking...'
                              : `💸 Unstake (${formatEther(userStake)} tBNB)`}
                          </button>
                        </>
                      )
                    } else {
                      return (
                        <>
                          <div className="form-group">
                            <label className="form-label">
                              💰 Minimum Stake (tBNB)
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              value={minArbitratorStake}
                              onChange={(e) =>
                                setMinArbitratorStake(e.target.value)
                              }
                              min="0.000000001"
                              step="0.000000001"
                              placeholder="0.000000001"
                              readOnly
                            />
                            <small className="form-hint">
                              Minimum stake required to become an arbitrator
                            </small>
                          </div>

                          <button
                            className="btn btn-primary btn-full"
                            onClick={registerArbitrator}
                            disabled={loading || !account?.address}
                          >
                            {loading
                              ? '⏳ Registering...'
                              : '⚖️ Register as Arbitrator'}
                          </button>
                        </>
                      )
                    }
                  })()}
                </div>
              </section>

              {/* Raise Dispute */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">🚨</span>
                  <h2 className="section-title">Raise Dispute</h2>
                </div>

                <div className="form-grid">
                  {activeArbitratorsCount === 0 && (
                    <div
                      className="form-group"
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-warning-bg, #fff3cd)',
                          border:
                            '1px solid var(--color-warning-border, #ffc107)',
                          borderRadius: '8px',
                          marginBottom: '1rem',
                        }}
                      >
                        <strong>⚠️ Warning:</strong> No active arbitrators are
                        currently registered. If you raise a dispute, it will be
                        automatically rejected after 7 days if no arbitrators
                        are assigned. Consider registering as an arbitrator
                        first to ensure disputes can be properly reviewed.
                      </div>
                    </div>
                  )}
                  {activeArbitratorsCount > 0 && activeArbitratorsCount < 3 && (
                    <div
                      className="form-group"
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-info-bg, #d1ecf1)',
                          border: '1px solid var(--color-info-border, #0c5460)',
                          borderRadius: '8px',
                          marginBottom: '1rem',
                          color: 'var(--color-info-text, #0c5460)',
                        }}
                      >
                        <strong>ℹ️ Info:</strong> Only {activeArbitratorsCount}{' '}
                        active arbitrator
                        {activeArbitratorsCount !== 1 ? 's' : ''} available
                        (recommended: 3). Disputes can still be processed with
                        fewer arbitrators.
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">🎯 Select IP Asset</label>
                    <select
                      className="form-select"
                      value={disputeTokenId}
                      onChange={(e) =>
                        setDisputeTokenId(Number(e.target.value))
                      }
                    >
                      {Array.from(ipAssets.keys()).map((id) => {
                        const asset = ipAssets.get(id)
                        const metadata = parsedMetadata.get(id) || {
                          name: 'Unknown',
                        }
                        return (
                          <option key={id} value={id}>
                            #{id} -{' '}
                            {metadata.name ||
                              asset?.ipHash.substring(0, 10) ||
                              'Unknown'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">📝 Dispute Reason</label>
                    <textarea
                      className="form-input"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      rows={4}
                      placeholder="Explain why you are disputing this IP asset..."
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={raiseDispute}
                    disabled={
                      loading || !account?.address || !disputeReason.trim()
                    }
                  >
                    {loading ? '⏳ Submitting...' : '🚨 Raise Dispute'}
                  </button>
                </div>
              </section>

              {/* Assign Arbitrators */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">👥</span>
                  <h2 className="section-title">
                    Assign Arbitrators to Dispute
                  </h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={assignDisputeId || ''}
                      onChange={(e) => {
                        setAssignDisputeId(Number(e.target.value) || 0)
                        setSelectedArbitrators([]) // Reset selection when dispute changes
                      }}
                    />
                    <small className="form-hint">
                      Select 1-3 active arbitrators to assign to this dispute.
                      You can select from the list of registered arbitrators
                      below.
                    </small>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">
                      ⚖️ Select Arbitrators ({selectedArbitrators.length}/3
                      selected)
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '0.75rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      {allArbitrators
                        .filter((addr) => {
                          const arb = arbitratorsMap.get(addr)
                          return arb && arb.isActive
                        })
                        .map((addr) => {
                          const arb = arbitratorsMap.get(addr)
                          if (!arb) return null
                          const isSelected = selectedArbitrators.includes(addr)

                          return (
                            <div
                              key={addr}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedArbitrators(
                                    selectedArbitrators.filter(
                                      (a) => a !== addr,
                                    ),
                                  )
                                } else {
                                  if (selectedArbitrators.length < 3) {
                                    // Warn if arbitrator has high workload
                                    if ((arb.activeDisputes || 0) >= 5) {
                                      notifyWarning(
                                        'High Workload',
                                        `This arbitrator already has ${arb.activeDisputes} active disputes. Consider selecting someone with less workload.`,
                                      )
                                    }
                                    setSelectedArbitrators([
                                      ...selectedArbitrators,
                                      addr,
                                    ])
                                  } else {
                                    notifyWarning(
                                      'Maximum Reached',
                                      'You can only select up to 3 arbitrators',
                                    )
                                  }
                                }
                              }}
                              style={{
                                padding: '1rem',
                                border: `2px solid ${
                                  isSelected
                                    ? 'var(--color-primary, #007bff)'
                                    : (arb.activeDisputes || 0) >= 5
                                      ? 'var(--color-danger, #dc3545)'
                                      : (arb.activeDisputes || 0) >= 3
                                        ? 'var(--color-warning, #ffc107)'
                                        : 'var(--color-border, #ddd)'
                                }`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                backgroundColor: isSelected
                                  ? 'var(--color-primary-bg, rgba(0, 123, 255, 0.1))'
                                  : (arb.activeDisputes || 0) >= 5
                                    ? 'rgba(220, 53, 69, 0.1)'
                                    : (arb.activeDisputes || 0) >= 3
                                      ? 'rgba(255, 193, 7, 0.1)'
                                      : 'transparent',
                                transition: 'all 0.2s',
                                opacity:
                                  (arb.activeDisputes || 0) >= 10 ? 0.6 : 1,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer' }}
                                />
                                <strong style={{ fontSize: '0.9rem' }}>
                                  {addr.substring(0, 10)}...
                                  {addr.substring(addr.length - 8)}
                                </strong>
                              </div>
                              <div
                                style={{
                                  fontSize: '0.85rem',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                <div>
                                  ⭐ Reputation: {Number(arb.reputation)}
                                </div>
                                <div>
                                  📊 Total Cases: {Number(arb.totalCases)}
                                </div>
                                <div
                                  style={{
                                    color:
                                      (arb.activeDisputes || 0) >= 5
                                        ? 'var(--color-danger, #dc3545)'
                                        : (arb.activeDisputes || 0) >= 3
                                          ? 'var(--color-warning, #ffc107)'
                                          : 'var(--color-text-secondary)',
                                    fontWeight:
                                      (arb.activeDisputes || 0) >= 3
                                        ? 'bold'
                                        : 'normal',
                                  }}
                                >
                                  ⚖️ Active Disputes: {arb.activeDisputes || 0}
                                  {(arb.activeDisputes || 0) >= 5 &&
                                    ' ⚠️ (High Workload)'}
                                  {(arb.activeDisputes || 0) >= 3 &&
                                    (arb.activeDisputes || 0) < 5 &&
                                    ' ⚡ (Moderate)'}
                                </div>
                                <div>
                                  💰 Stake: {formatEther(arb.stake)} tBNB
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    {allArbitrators.filter((addr) => {
                      const arb = arbitratorsMap.get(addr)
                      return arb && arb.isActive
                    }).length === 0 && (
                      <div
                        style={{
                          padding: '1rem',
                          textAlign: 'center',
                          color: 'var(--color-text-tertiary)',
                          marginTop: '0.5rem',
                        }}
                      >
                        No active arbitrators available. Register as an
                        arbitrator first.
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => {
                      if (
                        assignDisputeId > 0 &&
                        selectedArbitrators.length > 0
                      ) {
                        assignArbitrators(assignDisputeId, selectedArbitrators)
                      } else {
                        notifyError(
                          'Invalid Input',
                          'Please select a dispute ID and at least one arbitrator',
                        )
                      }
                    }}
                    disabled={
                      loading ||
                      !account?.address ||
                      assignDisputeId <= 0 ||
                      selectedArbitrators.length === 0
                    }
                  >
                    {loading
                      ? '⏳ Assigning...'
                      : `👥 Assign ${selectedArbitrators.length} Arbitrator${selectedArbitrators.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </section>

              {/* Submit Arbitration Decision */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⚖️</span>
                  <h2 className="section-title">Submit Arbitration Decision</h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={arbitrationDisputeId || ''}
                      onChange={(e) =>
                        setArbitrationDisputeId(Number(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">📊 Decision</label>
                    <select
                      className="form-select"
                      value={arbitrationDecision ? 'true' : 'false'}
                      onChange={(e) =>
                        setArbitrationDecision(e.target.value === 'true')
                      }
                    >
                      <option value="true">✅ Uphold Dispute</option>
                      <option value="false">❌ Reject Dispute</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      📝 Resolution Statement
                    </label>
                    <textarea
                      className="form-input"
                      value={arbitrationResolution}
                      onChange={(e) => setArbitrationResolution(e.target.value)}
                      rows={4}
                      placeholder="Explain your decision..."
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => {
                      if (arbitrationDisputeId > 0) {
                        submitArbitrationDecision(arbitrationDisputeId)
                      } else {
                        notifyError(
                          'Invalid Input',
                          'Please enter a dispute ID',
                        )
                      }
                    }}
                    disabled={
                      loading ||
                      !account?.address ||
                      !arbitrationResolution.trim() ||
                      arbitrationDisputeId <= 0
                    }
                  >
                    {loading ? '⏳ Submitting...' : '⚖️ Submit Decision'}
                  </button>
                </div>
              </section>

              {/* Check and Resolve After 24h */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⏱️</span>
                  <h2 className="section-title">
                    Resolve After 24h Wait Period
                  </h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={resolveDisputeId || ''}
                      onChange={(e) =>
                        setResolveDisputeId(Number(e.target.value) || 0)
                      }
                    />
                    <small className="form-hint">
                      Disputes automatically resolve when 3+ uphold votes exist
                      and 24 hours have passed since the 3rd uphold vote. This
                      button manually triggers resolution if needed (e.g., if
                      auto-resolution didn't trigger yet).
                    </small>
                  </div>

                  {!isOwner && (
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor:
                          'var(--color-warning-bg, rgba(255, 193, 7, 0.1))',
                        borderRadius: '8px',
                        color: 'var(--color-warning, #ffc107)',
                        marginBottom: '1rem',
                      }}
                    >
                      ⚠️ Only the contract owner can manually trigger
                      resolution.
                    </div>
                  )}
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => checkAndResolveArbitration(resolveDisputeId)}
                    disabled={
                      loading ||
                      !account?.address ||
                      resolveDisputeId <= 0 ||
                      !isOwner
                    }
                  >
                    {loading
                      ? '⏳ Checking...'
                      : '✅ Check & Resolve After 24h'}
                  </button>
                </div>
              </section>

              {/* Resolve Dispute Without Arbitrators */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⏰</span>
                  <h2 className="section-title">
                    Resolve Dispute (No Arbitrators)
                  </h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={resolveDisputeId || ''}
                      onChange={(e) =>
                        setResolveDisputeId(Number(e.target.value) || 0)
                      }
                    />
                    <small className="form-hint">
                      Only the dispute author can resolve disputes with no
                      arbitrators after the deadline has passed. The dispute
                      will be automatically rejected.
                    </small>
                  </div>

                  <button
                    className="btn btn-secondary btn-full"
                    onClick={() =>
                      resolveDisputeWithoutArbitrators(resolveDisputeId)
                    }
                    disabled={
                      loading || !account?.address || resolveDisputeId <= 0
                    }
                  >
                    {loading ? '⏳ Resolving...' : '⏰ Auto-Resolve Dispute'}
                  </button>
                </div>
              </section>

              {/* Disputes List */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">📋</span>
                  <h2 className="section-title">
                    All Disputes ({disputesMap.size} Total)
                  </h2>
                </div>

                <div className="grid grid-2">
                  {disputesMap.size > 0 ? (
                    Array.from(disputesMap.entries()).map(([id, dispute]) => {
                      const metadata = parsedMetadata.get(dispute.tokenId) || {
                        name: 'Unknown',
                      }
                      const disputeDate = new Date(
                        Number(dispute.timestamp) * 1000,
                      ).toLocaleDateString()

                      return (
                        <div key={id} className="card">
                          <div className="card-header">
                            <h3 className="card-title">
                              Dispute #{dispute.disputeId}
                            </h3>
                            <span
                              className={`badge ${dispute.isResolved ? 'badge-success' : 'badge-warning'}`}
                            >
                              {dispute.isResolved
                                ? '✅ Resolved'
                                : '⏳ Pending'}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="card-field">
                              <span className="card-field-label">
                                Dispute ID
                              </span>
                              <span className="card-field-value">
                                #{dispute.disputeId}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">IP Asset</span>
                              <span className="card-field-value">
                                #{dispute.tokenId} -{' '}
                                {metadata.name || 'Unknown'}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Disputer</span>
                              <span className="card-field-value address">
                                {dispute.disputer.substring(0, 10)}...
                                {dispute.disputer.substring(
                                  dispute.disputer.length - 8,
                                )}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Reason</span>
                              <span
                                className="card-field-value"
                                style={{ wordBreak: 'break-word' }}
                              >
                                {dispute.reason.length > 100
                                  ? `${dispute.reason.substring(0, 100)}...`
                                  : dispute.reason}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Date</span>
                              <span className="card-field-value">
                                {disputeDate}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Arbitration ID
                              </span>
                              <span className="card-field-value">
                                #{dispute.arbitrationId}
                              </span>
                            </div>
                            {dispute.isResolved &&
                              arbitrationsMap.has(dispute.arbitrationId) &&
                              (() => {
                                const arbitration = arbitrationsMap.get(
                                  dispute.arbitrationId,
                                )
                                const isUpheld =
                                  arbitration.votesFor >
                                  arbitration.votesAgainst
                                return (
                                  <div
                                    style={{
                                      marginTop: '1rem',
                                      padding: '1rem',
                                      backgroundColor:
                                        'var(--color-bg-secondary, #f5f5f5)',
                                      borderRadius: '8px',
                                    }}
                                  >
                                    <div
                                      className="card-field"
                                      style={{ marginBottom: '0.5rem' }}
                                    >
                                      <span className="card-field-label">
                                        Resolution Outcome
                                      </span>
                                      <span
                                        className={`card-field-value ${isUpheld ? 'text-success' : 'text-danger'}`}
                                        style={{ fontWeight: 'bold' }}
                                      >
                                        {isUpheld
                                          ? '✅ Dispute Upheld'
                                          : '❌ Dispute Rejected'}
                                      </span>
                                    </div>
                                    <div className="card-field">
                                      <span className="card-field-label">
                                        Votes
                                      </span>
                                      <span className="card-field-value">
                                        {arbitration.votesFor} For /{' '}
                                        {arbitration.votesAgainst} Against
                                      </span>
                                    </div>
                                    {arbitration.resolution &&
                                      arbitration.resolution.trim() && (
                                        <div
                                          className="card-field"
                                          style={{ marginTop: '0.5rem' }}
                                        >
                                          <span className="card-field-label">
                                            Resolution Statement
                                          </span>
                                          <span
                                            className="card-field-value"
                                            style={{
                                              wordBreak: 'break-word',
                                              fontSize: '0.9rem',
                                              color:
                                                'var(--color-text-secondary)',
                                            }}
                                          >
                                            {arbitration.resolution}
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                )
                              })()}
                            {!dispute.isResolved && (
                              <div
                                style={{
                                  marginTop: '1rem',
                                  display: 'flex',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setArbitrationDisputeId(dispute.disputeId)
                                    setResolveDisputeId(dispute.disputeId)
                                  }}
                                >
                                  Use This ID
                                </button>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setAssignDisputeId(dispute.disputeId)
                                    setSelectedArbitrators([])
                                    // Scroll to assign arbitrators section
                                    setTimeout(() => {
                                      const sections =
                                        document.querySelectorAll('.section')
                                      sections.forEach((section) => {
                                        const title =
                                          section.querySelector(
                                            '.section-title',
                                          )
                                        if (
                                          title &&
                                          title.textContent?.includes(
                                            'Assign Arbitrators',
                                          )
                                        ) {
                                          section.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start',
                                          })
                                        }
                                      })
                                    }, 100)
                                  }}
                                >
                                  👥 Assign Arbitrators
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div
                      className="card"
                      style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '3rem',
                      }}
                    >
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        📋
                      </div>
                      <h3
                        style={{
                          marginBottom: '0.5rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        No Disputes Yet
                      </h3>
                      <p style={{ color: 'var(--color-text-tertiary)' }}>
                        No disputes have been raised yet.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Arbitrators List */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">👥</span>
                  <h2 className="section-title">
                    Registered Arbitrators ({activeArbitratorsCount} Active)
                  </h2>
                </div>

                <div className="grid grid-2">
                  {allArbitrators.length > 0 ? (
                    allArbitrators.map((addr) => {
                      const arb = arbitratorsMap.get(addr)
                      if (!arb) return null
                      return (
                        <div key={addr} className="card">
                          <div className="card-header">
                            <h3 className="card-title">Arbitrator</h3>
                            <span
                              className={`badge ${arb.isActive ? 'badge-success' : 'badge-error'}`}
                            >
                              {arb.isActive ? '✅ Active' : '❌ Inactive'}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="card-field">
                              <span className="card-field-label">Address</span>
                              <span className="card-field-value address">
                                {addr.substring(0, 10)}...
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Stake</span>
                              <span className="card-field-value">
                                💰 {formatEther(arb.stake)} tBNB
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Reputation
                              </span>
                              <span className="card-field-value">
                                ⭐ {Number(arb.reputation)}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Total Cases
                              </span>
                              <span className="card-field-value">
                                📊 {Number(arb.totalCases)}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Active Disputes
                              </span>
                              <span
                                className="card-field-value"
                                style={{
                                  color:
                                    (arb.activeDisputes || 0) >= 5
                                      ? 'var(--color-danger, #dc3545)'
                                      : (arb.activeDisputes || 0) >= 3
                                        ? 'var(--color-warning, #ffc107)'
                                        : 'inherit',
                                  fontWeight:
                                    (arb.activeDisputes || 0) >= 3
                                      ? 'bold'
                                      : 'normal',
                                }}
                              >
                                ⚖️ {arb.activeDisputes || 0}
                                {(arb.activeDisputes || 0) >= 5 && ' ⚠️'}
                                {(arb.activeDisputes || 0) >= 3 &&
                                  (arb.activeDisputes || 0) < 5 &&
                                  ' ⚡'}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Success Rate
                              </span>
                              <span className="card-field-value">
                                {arb.totalCases > 0
                                  ? `${Math.round((Number(arb.successfulCases) / Number(arb.totalCases)) * 100)}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div
                      className="card"
                      style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '3rem',
                      }}
                    >
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        👥
                      </div>
                      <h3
                        style={{
                          marginBottom: '0.5rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        No Arbitrators Yet
                      </h3>
                      <p style={{ color: 'var(--color-text-tertiary)' }}>
                        Be the first to register as an arbitrator!
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* IP Assets Display */}
        <section className="section section-full">
          <div className="section-header">
            <span className="section-icon">🎨</span>
            <h2 className="section-title">Registered IP Assets</h2>
          </div>

          <div className="grid grid-3">
            {Array.from(ipAssets.entries()).map(([id, asset]) => {
              const metadata = parsedMetadata.get(id) || {
                name: 'Unknown',
                description: 'No description available',
              }
              const mediaUrl = getIPFSGatewayURL(asset.ipHash)

              return (
                <div key={id} className="card hover-lift animate-fade-in">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">
                        {metadata.name || `IP Asset #${id}`}
                      </h3>
                      <p className="card-subtitle">Token #{id}</p>
                    </div>
                    <div className="flex gap-2">
                      {asset.isEncrypted && (
                        <span className="badge badge-warning">
                          🔒 Encrypted
                        </span>
                      )}
                      {asset.isDisputed && (
                        <span className="badge badge-error">⚠️ Disputed</span>
                      )}
                      {infringementLoadingIds.has(id) && (
                        <span
                          className="badge"
                          style={{ opacity: 0.9 }}
                          title="Checking infringement..."
                        >
                          ⏳ Checking
                        </span>
                      )}
                      {!infringementLoadingIds.has(id) &&
                        infringementData.has(id) &&
                        (() => {
                          const infringement = infringementData.get(id)!
                          if (infringement.totalInfringements > 0) {
                            const severity = calculateSeverity(infringement)
                            const severityConfig = {
                              medium: {
                                icon: '⚡',
                                className: 'badge-warning',
                              },
                              high: { icon: '⚠️', className: 'badge-error' },
                              critical: {
                                icon: '🚨',
                                className: 'badge-error',
                              },
                              low: { icon: '✅', className: 'badge-success' },
                            }
                            const config =
                              severityConfig[severity] || severityConfig.low
                            return (
                              <span
                                className={`badge ${config.className}`}
                                style={{ cursor: 'default' }}
                                title={`${infringement.totalInfringements} infringement(s) detected`}
                              >
                                {config.icon} {infringement.totalInfringements}{' '}
                                Infringement
                                {infringement.totalInfringements !== 1
                                  ? 's'
                                  : ''}
                              </span>
                            )
                          }
                          return null
                        })()}
                    </div>
                  </div>

                  {/* Enhanced Media Preview - Always Show */}
                  <div className="media-preview">
                    <div className="media-container">
                      <EnhancedAssetPreview
                        assetId={id}
                        asset={asset}
                        metadata={metadata}
                        mediaUrl={
                          mediaUrl || getIPFSGatewayURL(asset.ipHash || '')
                        }
                      />
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-field">
                      <span className="card-field-label">Owner</span>
                      <span className="card-field-value address">
                        {asset.owner.substring(0, 10)}...
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">Description</span>
                      <span className="card-field-value">
                        {metadata.description || 'No description'}
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">IP Hash</span>
                      <span className="card-field-value address">
                        {asset.ipHash.substring(0, 20)}...
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">Total Revenue</span>
                      <span
                        className="card-field-value"
                        style={{
                          fontSize: '0.85rem',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%',
                          display: 'inline-block',
                        }}
                      >
                        💰{' '}
                        {parseFloat(formatEther(asset.totalRevenue)).toFixed(6)}{' '}
                        tBNB
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">Royalty Tokens</span>
                      <span className="card-field-value">
                        🎯 {Number(asset.royaltyTokens) / 100}%
                      </span>
                    </div>

                    {/* Infringement Status */}
                    <div className="card-field">
                      <span className="card-field-label">
                        Infringement Status
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {infringementLoadingIds.has(id) ? (
                          <span
                            className="card-field-value"
                            style={{ fontSize: '0.85rem', opacity: 0.8 }}
                          >
                            ⏳ Checking...
                          </span>
                        ) : infringementData.has(id) ? (
                          (() => {
                            const infringement = infringementData.get(id)!
                            const severity = calculateSeverity(infringement)
                            const hasInfringements =
                              infringement.totalInfringements > 0

                            const severityConfig = {
                              low: {
                                icon: '✅',
                                color: '#28a745',
                                bg: '#d4edda',
                              },
                              medium: {
                                icon: '⚡',
                                color: '#ffc107',
                                bg: '#fff3cd',
                              },
                              high: {
                                icon: '⚠️',
                                color: '#fd7e14',
                                bg: '#ffeaa7',
                              },
                              critical: {
                                icon: '🚨',
                                color: '#dc3545',
                                bg: '#f8d7da',
                              },
                            }

                            const config = severityConfig[severity]

                            return (
                              <>
                                <span
                                  className="card-field-value"
                                  style={{
                                    fontSize: '0.85rem',
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: config.bg,
                                    color: config.color,
                                    borderRadius: '4px',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  {config.icon}{' '}
                                  {hasInfringements
                                    ? `${infringement.totalInfringements} Found`
                                    : 'Clean'}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedInfringementTokenId(id)
                                    loadInfringementStatus(id)
                                  }}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor:
                                      'var(--color-primary, #007bff)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                  }}
                                  title="Check infringement status"
                                >
                                  🔍 Check Status
                                </button>
                              </>
                            )
                          })()
                        ) : (
                          <>
                            <span
                              className="card-field-value"
                              style={{ fontSize: '0.85rem', opacity: 0.7 }}
                            >
                              ⏳ Not Checked
                            </span>
                            <button
                              onClick={() => {
                                setSelectedInfringementTokenId(id)
                                loadInfringementStatus(id)
                              }}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                backgroundColor:
                                  'var(--color-secondary, #6c757d)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              🔍 Check Now
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {ipAssets.size === 0 && (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '3rem',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No IP Assets Yet
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>
                  Register your first IP asset to get started!
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Licenses Display */}
        <section className="section section-full">
          <div className="section-header">
            <span className="section-icon">🎫</span>
            <h2 className="section-title">Active Licenses</h2>
          </div>

          <div className="grid grid-2">
            {Array.from(licenses.entries()).map(([id, license]) => (
              <div key={id} className="card hover-lift animate-fade-in">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">License #{id}</h3>
                    <p className="card-subtitle">
                      IP Asset #{Number(license.tokenId)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {license.isActive ? (
                      <span className="badge badge-success">✅ Active</span>
                    ) : (
                      <span className="badge badge-error">❌ Inactive</span>
                    )}
                    {license.commercialUse && (
                      <span className="badge badge-info">💼 Commercial</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-field">
                    <span className="card-field-label">Licensee</span>
                    <span className="card-field-value address">
                      {license.licensee.substring(0, 10)}...
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Royalty Rate</span>
                    <span className="card-field-value">
                      💰 {Number(license.royaltyPercentage) / 100}%
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Duration</span>
                    <span className="card-field-value">
                      ⏰ {Number(license.duration)} seconds
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Start Date</span>
                    <span className="card-field-value">
                      📅{' '}
                      {new Date(
                        Number(license.startDate) * 1000,
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Terms Preview</span>
                    <span className="card-field-value">
                      {license.terms.substring(0, 30)}...
                    </span>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                  >
                    📄 View Terms
                  </button>
                  {license.isActive && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    >
                      🔄 Renew
                    </button>
                  )}
                </div>
              </div>
            ))}

            {licenses.size === 0 && (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '3rem',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎫</div>
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No Licenses Yet
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>
                  Mint your first license to start licensing IP assets!
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
