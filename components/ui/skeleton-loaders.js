'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Skeleton base component
export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
  )
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-lg bg-navy-light" />
            <Skeleton className="h-6 w-32 bg-navy-light" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <Skeleton className="h-4 w-24 mb-1 bg-navy-light" />
              <Skeleton className="h-4 w-16 bg-navy-light" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full bg-navy-light" />
          </div>
        </div>
      </header>

      {/* Main Content skeleton */}
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-5 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center p-6">
                <Skeleton className="h-12 w-12 rounded-lg mr-4" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-5 w-5" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

// Cases list skeleton
export function CasesListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 rounded-lg border bg-navy-primary border-navy-light">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-2 bg-navy-light" />
              <Skeleton className="h-3 w-20 bg-navy-light" />
            </div>
            <Skeleton className="h-5 w-5 rounded bg-navy-light" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <Skeleton className="h-3 w-16 bg-navy-light" />
            <Skeleton className="h-3 w-24 bg-navy-light" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Case detail skeleton
export function CaseDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-navy-secondary border-navy-light">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-8 w-64 mb-2 bg-navy-light" />
              <Skeleton className="h-4 w-40 mb-3 bg-navy-light" />
              <div className="flex items-center space-x-4">
                <Skeleton className="h-4 w-24 bg-navy-light" />
                <Skeleton className="h-4 w-20 bg-navy-light" />
              </div>
            </div>
            <Skeleton className="h-10 w-40 bg-navy-light" />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Skeleton className="h-10 flex-1 bg-blue-200" />
        <Skeleton className="h-10 flex-1 bg-purple-200" />
        <Skeleton className="h-10 flex-1 bg-green-200" />
      </div>

      {/* Documents Card */}
      <Card className="bg-navy-secondary border-navy-light">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2 bg-navy-light" />
          <Skeleton className="h-4 w-32 bg-navy-light" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-navy-primary rounded-lg border border-navy-light">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-6 w-6 bg-navy-light" />
                    <div>
                      <Skeleton className="h-4 w-48 mb-1 bg-navy-light" />
                      <Skeleton className="h-3 w-32 bg-navy-light" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 bg-navy-light" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Trends skeleton
export function TrendsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy-primary border-b border-navy-light">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-lg bg-navy-light" />
            <Skeleton className="h-6 w-32 bg-navy-light" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Tabs */}
        <Skeleton className="h-10 w-full max-w-md mb-6" />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

// Documents list skeleton
export function DocumentsListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div>
                  <Skeleton className="h-5 w-48 mb-2" />
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Generic table skeleton
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex space-x-4 pb-2 border-b">
        {Array(columns).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array(rows).fill(0).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 py-2">
          {Array(columns).fill(0).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
