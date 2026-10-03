import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AccessDenied } from '../../components/access-denied.tsx'
import { EmptyState } from '../../components/empty-state.tsx'
import { PageHeader } from '../../components/page-header.tsx'
import { Badge } from '../../components/ui/badge.tsx'
import { Button } from '../../components/ui/button.tsx'
import { Card, CardBody } from '../../components/ui/card.tsx'
import { Input } from '../../components/ui/input.tsx'
import { Textarea } from '../../components/ui/textarea.tsx'
import { useCurrentUser, useDatabase, usePageTitle, useSyncPortal } from '../../hooks/use-portal.ts'
import { formatBytes, formatDate, fullName } from '../../lib/format.ts'
import { materialCategoryLabels } from '../../lib/labels.ts'
import { sanitiseFileName } from '../../lib/files.ts'
import {
  canAccessCourse,
  courseById,
  userById,
  visibleCourses,
  visibleMaterials,
} from '../../services/access.ts'
import { addMaterial, archiveMaterial } from '../../services/api.ts'
import { downloadTextFile } from '../../utils/download.ts'
import type { MaterialCategory } from '../../types/index.ts'

const categories = Object.keys(materialCategoryLabels) as MaterialCategory[]

export function StudentMaterials() {
  const { courseId = '' } = useParams()
  const user = useCurrentUser()
  const database = useDatabase()
  const course = courseById(database, courseId)
  const [category, setCategory] = useState<MaterialCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  usePageTitle(course ? `${course.name} materials` : 'Materials')
  if (!user) return null
  if (!course || !canAccessCourse(database, user, course.id)) return <AccessDenied home="/app" />
  const materials = visibleMaterials(database, user, course.id).filter((material) => {
    const matchesCategory = category === 'all' || material.category === category
    const haystack = `${material.title} ${material.description}`.toLowerCase()
    return matchesCategory && haystack.includes(search.trim().toLowerCase())
  })

  return (
    <div>
      <PageHeader title="Materials" description={`${course.name}. You can download files for this enrolment only.`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input aria-label="Search materials" placeholder="Search materials" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Category" className="h-11 rounded-md border border-line bg-white px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as MaterialCategory | 'all')}>
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>{materialCategoryLabels[item]}</option>
          ))}
        </select>
      </div>
      {materials.length === 0 ? (
        <EmptyState title="No materials in this view">Try another category, or check back after your facilitator publishes a file.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {materials.map((material) => (
            <Card key={material.id}>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge>{materialCategoryLabels[material.category]}</Badge>
                  <h2 className="mt-2 font-semibold text-navy">{material.title}</h2>
                  <p className="text-sm text-muted">{material.description}</p>
                  <p className="mt-1 text-xs text-muted">{material.fileName} · {formatBytes(material.sizeBytes)} · {formatDate(material.uploadedAt)}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadTextFile(
                      sanitiseFileName(material.fileName.replace(/\.[^.]+$/, '') + '-record.txt'),
                      `${material.title}\n\nSTK College prototype\nThis is a text copy of the material record. Production files are stored in a private bucket and opened with a signed link.\n\n${material.description}\n`,
                    )
                  }
                >
                  Download
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function StaffMaterials() {
  usePageTitle('Materials')
  const user = useCurrentUser()
  const database = useDatabase()
  const sync = useSyncPortal()
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<MaterialCategory>('notes')
  const [file, setFile] = useState<File | null>(null)
  if (!user) return null
  const courses = visibleCourses(database, user)
  const selectedCourse = courseId || courses[0]?.id || ''
  const materials = visibleMaterials(database, user, selectedCourse || undefined)

  return (
    <div className="grid gap-6">
      <PageHeader title="Materials" description="File details are checked before a record is saved. The prototype keeps the metadata, not the file itself." />
      <form
        className="grid gap-3 rounded-lg border border-line bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!file || !selectedCourse) {
            toast.error('Choose a course and a file.')
            return
          }
          try {
            addMaterial(user.id, {
              courseId: selectedCourse,
              moduleId: null,
              title,
              description,
              category,
              file: { name: file.name, type: file.type, size: file.size },
            })
            sync()
            setTitle('')
            setDescription('')
            setFile(null)
            toast.success('Material record saved.')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The file was not accepted.')
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor="material-course">
            Course
            <select id="material-course" className="h-11 rounded-md border border-line px-3 font-normal" value={selectedCourse} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor="material-category">
            Category
            <select id="material-category" className="h-11 rounded-md border border-line px-3 font-normal" value={category} onChange={(event) => setCategory(event.target.value as MaterialCategory)}>
              {categories.map((item) => (
                <option key={item} value={item}>{materialCategoryLabels[item]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="material-title">
          Title
          <Input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="material-description">
          Description
          <Textarea id="material-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="material-file">
          File
          <input id="material-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <Button type="submit">Save material</Button>
      </form>
      <div className="grid gap-3">
        {materials.map((material) => {
          const uploader = userById(database, material.uploadedBy)
          return (
            <Card key={material.id}>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge tone={material.status === 'archived' ? 'neutral' : 'navy'}>{material.status}</Badge>
                  <h2 className="mt-2 font-semibold text-navy">{material.title}</h2>
                  <p className="text-sm text-muted">{materialCategoryLabels[material.category]} · {material.fileName} · {uploader ? fullName(uploader) : 'Staff'}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      archiveMaterial(user.id, material.id)
                      sync()
                      toast.success(material.status === 'archived' ? 'Material published again.' : 'Material archived.')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'The material could not be updated.')
                    }
                  }}
                >
                  {material.status === 'archived' ? 'Publish' : 'Archive'}
                </Button>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
