from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema_view, extend_schema
from apps.users.mixins import AuditModelViewSetMixin
from .models import Category
from .serializers import CategoryTreeSerializer, CategoryListSerializer, CategoryWriteSerializer
from common.permissions import IsAdminRole


@extend_schema_view(
    list=extend_schema(summary="类别列表(扁平)"),
    retrieve=extend_schema(summary="类别详情"),
    create=extend_schema(summary="创建类别"),
    update=extend_schema(summary="更新类别"),
    partial_update=extend_schema(summary="部分更新类别"),
    destroy=extend_schema(summary="删除类别"),
)
class CategoryViewSet(AuditModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["node_type", "parent"]
    search_fields = ["name"]
    ordering_fields = ["sort_order", "model_index"]
    ordering = ["sort_order"]

    def get_serializer_class(self):
        if self.action == "list":
            return CategoryListSerializer
        if self.action == "retrieve":
            return CategoryTreeSerializer
        return CategoryWriteSerializer

    def create(self, request, *args, **kwargs):
        # 输入用 WriteSerializer 校验，输出用 ListSerializer 返回完整对象（含 id）
        serializer = CategoryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            CategoryListSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = CategoryWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(CategoryListSerializer(instance).data)

    @extend_schema(summary="获取完整类别树")
    @action(detail=False, methods=["get"])
    def tree(self, request):
        roots = Category.objects.roots().prefetch_related("children__children")
        serializer = CategoryTreeSerializer(roots, many=True)
        return Response({"code": 0, "message": "ok", "data": serializer.data})

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminRole()]
        return super().get_permissions()
