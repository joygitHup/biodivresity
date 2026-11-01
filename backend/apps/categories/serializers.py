from rest_framework import serializers
from .models import Category


class CategoryTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "node_type", "model_index", "description", "sort_order", "children"]

    def get_children(self, obj):
        children = obj.children.all()
        if children.exists():
            return CategoryTreeSerializer(children, many=True).data
        return []


class CategoryListSerializer(serializers.ModelSerializer):
    parentName = serializers.CharField(source="parent.name", default="")

    class Meta:
        model = Category
        fields = ["id", "name", "parent", "parentName", "node_type", "model_index", "sort_order"]


class CategoryWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["parent", "name", "node_type", "model_index", "description", "sort_order"]
