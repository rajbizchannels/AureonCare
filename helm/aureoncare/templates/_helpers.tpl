{{/*
AureonCare Helm Chart Helpers
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "aureoncare.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this.
If release name contains chart name it will be used as a full name.
*/}}
{{- define "aureoncare.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "aureoncare.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "aureoncare.labels" -}}
helm.sh/chart: {{ include "aureoncare.chart" . }}
{{ include "aureoncare.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — used in Deployment selector and Service selector.
Must remain stable across upgrades (do NOT include version/chart here).
*/}}
{{- define "aureoncare.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aureoncare.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "aureoncare.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "aureoncare.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend image reference.
*/}}
{{- define "aureoncare.backendImage" -}}
{{- printf "%s/%s-backend:%s" .Values.image.registry .Values.image.repository .Values.image.tag }}
{{- end }}

{{/*
Frontend image reference.
*/}}
{{- define "aureoncare.frontendImage" -}}
{{- printf "%s/%s-frontend:%s" .Values.image.registry .Values.image.repository .Values.image.tag }}
{{- end }}

{{/*
Update agent image reference.
*/}}
{{- define "aureoncare.updateAgentImage" -}}
{{- printf "%s/%s-update-agent:%s" .Values.image.registry .Values.image.repository .Values.image.tag }}
{{- end }}

{{/*
PostgreSQL hostname — either in-cluster subchart or passthrough.
*/}}
{{- define "aureoncare.postgresHost" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "aureoncare.fullname" .) }}
{{- else }}
{{- "external-postgres" }}
{{- end }}
{{- end }}

{{/*
Redis hostname — either in-cluster subchart or passthrough.
*/}}
{{- define "aureoncare.redisHost" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "aureoncare.fullname" .) }}
{{- else }}
{{- "external-redis" }}
{{- end }}
{{- end }}
