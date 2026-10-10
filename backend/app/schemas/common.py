from typing import ClassVar, Self

from pydantic import BaseModel, ConfigDict, model_validator


class SchemaBase(BaseModel):
	model_config = ConfigDict(from_attributes=True, extra="forbid")


class UpdateSchema(SchemaBase):
	NON_NULLABLE_UPDATE_FIELDS: ClassVar[frozenset[str]] = frozenset()

	@model_validator(mode="after")
	def reject_explicit_nulls(self) -> Self:
		"""Reject nulls for fields that are optional only to support partial updates."""
		null_fields = [
			field_name
			for field_name in self.model_fields_set
			if field_name in self.NON_NULLABLE_UPDATE_FIELDS
			and getattr(self, field_name) is None
		]
		if null_fields:
			fields = ", ".join(sorted(null_fields))
			raise ValueError(f"Update fields cannot be null: {fields}")
		return self